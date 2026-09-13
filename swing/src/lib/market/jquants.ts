import type { Bar } from './types'

/**
 * J-Quants API (V2) から日足を取る。
 *
 * V2は固定のAPIキーを x-api-key ヘッダに載せるだけで、トークンの交換が要らない。
 * 取るのは調整済みの値(AdjO/AdjH/AdjL/AdjC/AdjVo)。分割や併合をまたいでも段差が出ないので、
 * 手で貼っていたときの「分割で価格が飛ぶ」問題がそもそも起きない。
 */
const BASE_URL = 'https://api.jquants.com'
const BARS_PATH = '/v2/equities/bars/daily'
const MASTER_PATH = '/v2/equities/master'
/** 自前の中継(ブラウザから直接叩けないとき用)。 */
const RELAY_PATH = '/api/jquants'
/** 1銘柄で回すページ数の上限。無限ループにしない。 */
const MAX_PAGES = 20
/** 全銘柄ぶんは件数が桁違いなので、こちらは多めに見る。 */
const MAX_MARKET_PAGES = 60

export type JQuantsFailure =
  | { kind: 'auth'; message: string }
  | { kind: 'rate'; message: string }
  | { kind: 'server'; message: string }
  | { kind: 'network'; message: string }
  | { kind: 'empty'; message: string }

export class JQuantsError extends Error {
  readonly kind: JQuantsFailure['kind']
  constructor(failure: JQuantsFailure) {
    super(failure.message)
    this.name = 'JQuantsError'
    this.kind = failure.kind
  }
}

type Row = {
  Date?: string
  AdjO?: number | null
  AdjH?: number | null
  AdjL?: number | null
  AdjC?: number | null
  AdjVo?: number | null
}

type Page = { data?: Row[]; pagination_key?: string | null }

/** YYYY-MM-DD。APIはハイフン有り無しどちらも受け付ける。 */
const isoDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`

/** 今日からさかのぼった日付。初回の取り込み範囲を決めるのに使う。 */
export function daysAgo(days: number, now = new Date()): string {
  const date = new Date(now)
  date.setDate(date.getDate() - days)
  return isoDate(date)
}

/**
 * 取引が無かった日は四本値がnullで返ってくる。指標の計算が壊れるので落とす。
 */
export function rowsToBars(rows: Row[]): Bar[] {
  const bars: Bar[] = []
  for (const row of rows) {
    const { Date: date, AdjO, AdjH, AdjL, AdjC, AdjVo } = row
    if (!date) continue
    if (AdjO == null || AdjH == null || AdjL == null || AdjC == null) continue
    bars.push({
      date: date.slice(0, 10),
      open: AdjO,
      high: AdjH,
      low: AdjL,
      close: AdjC,
      volume: AdjVo ?? 0,
    })
  }
  return bars.sort((a, b) => a.date.localeCompare(b.date))
}

const failureFor = (status: number): JQuantsFailure => {
  if (status === 401 || status === 403) {
    return { kind: 'auth', message: 'APIキーが違うか、期限切れです。設定タブで入れ直してください。' }
  }
  if (status === 429) {
    return { kind: 'rate', message: 'J-Quantsの利用上限に達しました。しばらく待ってからやり直してください。' }
  }
  return { kind: 'server', message: `J-Quantsがエラーを返しました(${status})。` }
}

type FetchLike = typeof fetch

async function requestPage(
  fetchImpl: FetchLike,
  url: string,
  apiKey: string,
  viaRelay: boolean,
): Promise<Page> {
  // 中継を通すときは、キーをそのまま転送する(サーバーには保存しない)。
  const response = await fetchImpl(url, {
    headers: { 'x-api-key': apiKey },
  })
  if (!response.ok) throw new JQuantsError(failureFor(response.status))
  const body = (await response.json()) as Page
  if (!body || typeof body !== 'object') {
    throw new JQuantsError({
      kind: 'server',
      message: `J-Quantsの応答を読めませんでした${viaRelay ? '(中継経由)' : ''}。`,
    })
  }
  return body
}

function buildUrl(base: string, params: Record<string, string>): string {
  const query = new URLSearchParams(params)
  return `${base}?${query.toString()}`
}

/** 1日分の全銘柄。銘柄を探すときに使う、ふるいの1段目。 */
export type MarketRow = {
  code: string
  close: number
  high: number
  low: number
  /** その日の売買代金(円)。出入りのしやすさ。 */
  turnover: number
}

type MarketApiRow = Row & { Code?: string; C?: number | null; H?: number | null; L?: number | null; Va?: number | null }

export function rowsToMarket(rows: MarketApiRow[]): MarketRow[] {
  const out: MarketRow[] = []
  for (const row of rows) {
    // 調整前の値でよい。その日の水準と商いを見るだけで、指標は計算しない。
    if (!row.Code || row.C == null || row.H == null || row.L == null) continue
    out.push({
      code: row.Code,
      close: row.C,
      high: row.H,
      low: row.L,
      turnover: row.Va ?? 0,
    })
  }
  return out
}

/**
 * 指定した日の全上場銘柄を取る。休場日は空で返るので、呼ぶ側で前日へさかのぼる。
 */
export async function fetchMarketDay(input: {
  apiKey: string
  date: string
  fetchImpl?: FetchLike
  allowRelay?: boolean
}): Promise<MarketRow[]> {
  const rows = await fetchAll({
    apiKey: input.apiKey,
    path: BARS_PATH,
    params: { date: input.date },
    maxPages: MAX_MARKET_PAGES,
    fetchImpl: input.fetchImpl,
    allowRelay: input.allowRelay,
  })
  return rowsToMarket(rows as MarketApiRow[])
}

/** 上場銘柄一覧。会社名と業種を引くのに使う。 */
export type MasterRow = {
  code: string
  name: string
  /** 33業種コード名。同じ業種を持ちすぎないための判定に使う。 */
  sector: string
  market: string
}

type MasterApiRow = {
  Code?: string
  CoName?: string
  S33Nm?: string
  MktNm?: string
}

export function rowsToMaster(rows: MasterApiRow[]): MasterRow[] {
  const out: MasterRow[] = []
  for (const row of rows) {
    if (!row.Code || !row.CoName) continue
    out.push({
      code: row.Code,
      name: row.CoName,
      sector: row.S33Nm ?? '',
      market: row.MktNm ?? '',
    })
  }
  return out
}

/**
 * 全上場銘柄の会社名と業種を取る。日付を省くと当日時点の一覧が返る。
 */
export async function fetchMaster(input: {
  apiKey: string
  fetchImpl?: FetchLike
  allowRelay?: boolean
}): Promise<MasterRow[]> {
  const rows = await fetchAll({
    apiKey: input.apiKey,
    path: MASTER_PATH,
    params: {},
    maxPages: MAX_MARKET_PAGES,
    fetchImpl: input.fetchImpl,
    allowRelay: input.allowRelay,
  })
  return rowsToMaster(rows as MasterApiRow[])
}

/**
 * pagination_key を辿って全ページ取る。直接叩けなければ中継に切り替える。
 */
async function fetchAll(input: {
  apiKey: string
  path: string
  params: Record<string, string>
  maxPages: number
  fetchImpl?: FetchLike
  allowRelay?: boolean
}): Promise<Row[]> {
  const { apiKey, path, params, maxPages } = input
  const fetchImpl = input.fetchImpl ?? fetch
  const allowRelay = input.allowRelay ?? true
  if (!apiKey) {
    throw new JQuantsError({ kind: 'auth', message: 'APIキーが設定されていません。' })
  }

  const rows: Row[] = []
  let viaRelay = false
  let paginationKey: string | undefined

  for (let page = 0; page < maxPages; page += 1) {
    const query: Record<string, string> = { ...params }
    if (paginationKey) query.pagination_key = paginationKey
    // 中継を通すときは、どのAPIかを path で伝える(中継側は許可した2つしか通さない)。
    if (viaRelay) query.path = path
    const base = viaRelay ? RELAY_PATH : `${BASE_URL}${path}`

    let body: Page
    try {
      body = await requestPage(fetchImpl, buildUrl(base, query), apiKey, viaRelay)
    } catch (error) {
      if (error instanceof JQuantsError) throw error
      // fetch が例外を投げるのは、通信できなかったときとCORSで止められたとき。
      if (!viaRelay && allowRelay) {
        viaRelay = true
        page -= 1
        continue
      }
      throw new JQuantsError({
        kind: 'network',
        message: 'J-Quantsに接続できませんでした。通信環境を確かめてください。',
      })
    }

    rows.push(...(body.data ?? []))
    paginationKey = body.pagination_key ?? undefined
    if (!paginationKey) break
  }
  return rows
}

/**
 * 1銘柄の日足を、期間を指定して取る。
 *
 * ブラウザから api.jquants.com を直接叩けるかどうか(CORS)は環境次第なので、
 * 直接が駄目なら同じオリジンの中継に切り替える。HTTPエラーで返ってきたときは
 * 通信自体は成立しているので、切り替えずにそのまま伝える。
 */
export async function fetchDailyBars(input: {
  apiKey: string
  code: string
  from: string
  to: string
  fetchImpl?: FetchLike
  /** テスト用。直接が失敗したときに中継へ切り替えるか。 */
  allowRelay?: boolean
}): Promise<Bar[]> {
  const { apiKey, code, from, to } = input
  const rows = await fetchAll({
    apiKey,
    path: BARS_PATH,
    params: { code, from, to },
    maxPages: MAX_PAGES,
    fetchImpl: input.fetchImpl,
    allowRelay: input.allowRelay,
  })

  const bars = rowsToBars(rows)
  if (bars.length === 0) {
    throw new JQuantsError({
      kind: 'empty',
      message: `${code} のデータが返ってきませんでした。銘柄コードを確かめてください。`,
    })
  }
  return bars
}
