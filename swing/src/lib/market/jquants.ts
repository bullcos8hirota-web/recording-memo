import type { Bar } from './types'

/**
 * J-Quants API (V2) から日足を取る。
 *
 * V2は固定のAPIキーを x-api-key ヘッダに載せるだけで、トークンの交換が要らない。
 * 取るのは調整済みの値(AdjO/AdjH/AdjL/AdjC/AdjVo)。分割や併合をまたいでも段差が出ないので、
 * 手で貼っていたときの「分割で価格が飛ぶ」問題がそもそも起きない。
 */
const BASE_URL = 'https://api.jquants.com'
const PATH = '/v2/equities/bars/daily'
/** 自前の中継(ブラウザから直接叩けないとき用)。 */
const RELAY_PATH = '/api/jquants'
/** 1銘柄で回すページ数の上限。無限ループにしない。 */
const MAX_PAGES = 20

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
  const fetchImpl = input.fetchImpl ?? fetch
  const allowRelay = input.allowRelay ?? true
  if (!apiKey) {
    throw new JQuantsError({ kind: 'auth', message: 'APIキーが設定されていません。' })
  }

  const rows: Row[] = []
  let viaRelay = false
  let paginationKey: string | undefined

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params: Record<string, string> = { code, from, to }
    if (paginationKey) params.pagination_key = paginationKey
    const base = viaRelay ? RELAY_PATH : `${BASE_URL}${PATH}`

    let body: Page
    try {
      body = await requestPage(fetchImpl, buildUrl(base, params), apiKey, viaRelay)
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

  const bars = rowsToBars(rows)
  if (bars.length === 0) {
    throw new JQuantsError({
      kind: 'empty',
      message: `${code} のデータが返ってきませんでした。銘柄コードを確かめてください。`,
    })
  }
  return bars
}
