import type { Bar } from './types'

/**
 * 区切り文字を1行目から判定する。表計算やWebページの表をコピーするとタブ区切りに
 * なるが、その中の数値は「1,234」と桁区切りされている。カンマも区切りとして扱うと
 * 数値が分断されるため、どちらか一方に決める。
 */
function detectDelimiter(source: string): ',' | '\t' {
  const firstLine = source.split(/\r?\n/).find((line) => line.trim() !== '') ?? ''
  const tabs = (firstLine.match(/\t/g) ?? []).length
  const commas = (firstLine.match(/,/g) ?? []).length
  return tabs > commas ? '\t' : ','
}

/** RFC4180風のCSVパーサ。引用符とCRLF、BOMを扱う。 */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, '')
  const delimiter = detectDelimiter(source)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }
    if (char === '"') {
      quoted = true
    } else if (char === delimiter) {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

/**
 * 証券会社のCSVはShift_JISで出力されることが多いので、
 * UTF-8として読めなければShift_JISで読み直す。
 */
export async function readCsvFile(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer()
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return new TextDecoder('shift_jis').decode(buffer)
  }
}

const toHalfWidth = (value: string): string =>
  value.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  )

/** 「1,234.5」「1,234円」「▲500」などを数値にする。 */
export function parseNumber(value: string): number | null {
  if (value === undefined || value === null) return null
  const cleaned = toHalfWidth(String(value))
    .replace(/[,\s円株]/g, '')
    .replace(/^▲/, '-')
    .replace(/^△/, '-')
    .replace(/^\+/, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '--') return null
  const num = Number(cleaned)
  return Number.isFinite(num) ? num : null
}

/**
 * 「2026/8/18」「2026-08-18」「20260818」「2026年8月18日」「26/8/18」を YYYY-MM-DD にする。
 * 証券会社や情報サイトの表は西暦2桁のことがあるため、年が2桁なら2000年代として扱う
 * (株価データで1900年代を入力することは実質ないが、70以上は1900年代とみなす)。
 */
export function parseDate(value: string): string | null {
  if (!value) return null
  const text = toHalfWidth(value.trim())
  const ymd = text.match(/^(\d{4})[/\-年.](\d{1,2})[/\-月.](\d{1,2})/)
  if (ymd) return iso(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]))
  const shortYear = text.match(/^(\d{2})[/\-年.](\d{1,2})[/\-月.](\d{1,2})/)
  if (shortYear) {
    const year = Number(shortYear[1])
    return iso(year <= 69 ? 2000 + year : 1900 + year, Number(shortYear[2]), Number(shortYear[3]))
  }
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (compact) return iso(Number(compact[1]), Number(compact[2]), Number(compact[3]))
  return null
}

function iso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const HEADER_ALIASES: Record<keyof Bar, string[]> = {
  date: ['日付', '日時', '年月日', 'date', '約定日'],
  open: ['始値', '寄付', 'open'],
  high: ['高値', 'high'],
  low: ['安値', 'low'],
  close: ['終値', '引値', '調整後終値', 'close', 'adj close'],
  volume: ['出来高', '売買高', 'volume'],
}

function findColumn(header: string[], keys: string[]): number {
  const normalized = header.map((cell) => toHalfWidth(cell).trim().toLowerCase())
  for (const key of keys) {
    const index = normalized.findIndex((cell) => cell === key.toLowerCase())
    if (index >= 0) return index
  }
  for (const key of keys) {
    const index = normalized.findIndex((cell) => cell.includes(key.toLowerCase()))
    if (index >= 0) return index
  }
  return -1
}

export type ParseResult<T> = { rows: T[]; skipped: number; error: string | null }

/**
 * 日足の株価CSVを読み込む。ヘッダー行があればそれを見て列を判定し、
 * 無ければ「日付,始値,高値,安値,終値,出来高」の並びとみなす。
 */
export function parsePriceCsv(text: string): ParseResult<Bar> {
  const table = parseCsv(text)
  if (table.length === 0) return { rows: [], skipped: 0, error: 'データが空です。' }

  const headerIndex = table.findIndex(
    (row) => findColumn(row, HEADER_ALIASES.date) >= 0 && findColumn(row, HEADER_ALIASES.close) >= 0,
  )
  const header = headerIndex >= 0 ? table[headerIndex] : null
  const columns = header
    ? {
        date: findColumn(header, HEADER_ALIASES.date),
        open: findColumn(header, HEADER_ALIASES.open),
        high: findColumn(header, HEADER_ALIASES.high),
        low: findColumn(header, HEADER_ALIASES.low),
        close: findColumn(header, HEADER_ALIASES.close),
        volume: findColumn(header, HEADER_ALIASES.volume),
      }
    : { date: 0, open: 1, high: 2, low: 3, close: 4, volume: 5 }

  if (columns.close < 0) {
    return { rows: [], skipped: 0, error: '終値の列が見つかりませんでした。' }
  }

  const body = headerIndex >= 0 ? table.slice(headerIndex + 1) : table
  const bars: Bar[] = []
  let skipped = 0

  for (const row of body) {
    const date = parseDate(row[columns.date] ?? '')
    const close = parseNumber(row[columns.close] ?? '')
    if (!date || close === null || close <= 0) {
      skipped += 1
      continue
    }
    const open = columns.open >= 0 ? parseNumber(row[columns.open] ?? '') : null
    const high = columns.high >= 0 ? parseNumber(row[columns.high] ?? '') : null
    const low = columns.low >= 0 ? parseNumber(row[columns.low] ?? '') : null
    const volume = columns.volume >= 0 ? parseNumber(row[columns.volume] ?? '') : null
    bars.push({
      date,
      open: open ?? close,
      high: high ?? Math.max(open ?? close, close),
      low: low ?? Math.min(open ?? close, close),
      close,
      volume: volume ?? 0,
    })
  }

  bars.sort((a, b) => a.date.localeCompare(b.date))
  const deduped: Bar[] = []
  for (const bar of bars) {
    if (deduped.length && deduped[deduped.length - 1].date === bar.date) {
      deduped[deduped.length - 1] = bar
      continue
    }
    deduped.push(bar)
  }

  if (deduped.length === 0) {
    // スマホのコピーでよくある「1セルずつ改行」の形を読み直す
    const vertical = parseVerticalQuoteTable(text)
    if (vertical.rows.length > 0) return vertical
    return {
      rows: [],
      skipped,
      error:
        '読み取れる行がありませんでした。日付と株価が並んでいるか確認してください(日付と終値だけでも取り込めます)。',
    }
  }

  return { rows: deduped, skipped, error: null }
}


/**
 * スマホで表をコピーすると、1セルごとに改行された「縦並び」になる。
 *
 *   26/5/29      ← 日付
 *   97,200       ← 出来高
 *   1,073        ← 始値
 *   1,085        ← 高値
 *   1,051        ← 安値
 *   1,073        ← 終値
 *
 * 見出しが含まれるとは限らない(途中から貼ることもある)ので、見出しには頼らず、
 * 日付を区切りにして「4本値らしい並び」を値の関係から探す。
 * 始値・高値・安値・終値は必ず「2番目が最大、3番目が最小」になるため、
 * この形の並びを後ろから探せば、列の順番が違うサイトでも拾える。
 */
function findOhlcWindow(values: number[]): { index: number; ohlc: number[] } | null {
  for (let i = values.length - 4; i >= 0; i -= 1) {
    const window = values.slice(i, i + 4)
    const high = Math.max(...window)
    const low = Math.min(...window)
    if (window[1] !== high || window[2] !== low) continue
    // 1日の値幅としてありえない開きがあるものは別の列の並びとみなす
    if (low <= 0 || high / low > 1.5) continue
    return { index: i, ohlc: window }
  }
  return null
}

/**
 * 出来高らしい値かどうか。株数なので整数で、その日の高値より大きい。
 * 「株価の何倍以上」という条件にすると、値がさりで薄い銘柄の出来高を取りこぼす。
 * PERやPBRは小数なので整数の条件で外れ、調整後終値は高値を超えないので外れる。
 */
const looksLikeVolume = (value: number, high: number): boolean =>
  Number.isInteger(value) && value > high

/**
 * 4本値の前後から出来高を探す。サイトによって並びが違うため。
 *   Yahoo!ファイナンス: PER PBR [出来高] 始値 高値 安値 終値 調整後終値
 *   株探:               始値 高値 安値 終値 前日比 前日比(%) [売買高]
 */
function findVolume(values: number[], start: number, high: number): number {
  const before = start > 0 ? values[start - 1] : null
  if (before !== null && looksLikeVolume(before, high)) return before
  const after = values.slice(start + 4).find((value) => looksLikeVolume(value, high))
  return after ?? 0
}

export function parseVerticalQuoteTable(text: string): ParseResult<Bar> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')

  type Record = { date: string; values: string[] }
  const records: Record[] = []

  for (const line of lines) {
    const date = parseDate(line)
    if (date) {
      records.push({ date, values: [] })
      continue
    }
    // 最初の日付より前(見出しなど)は捨てる
    if (records.length === 0) continue
    records[records.length - 1].values.push(line)
  }

  const bars: Bar[] = []
  let skipped = 0

  for (const record of records) {
    const values = record.values
      .map((value) => parseNumber(value))
      .filter((value): value is number => value !== null && value > 0)

    const window = findOhlcWindow(values)
    if (window) {
      const [open, high, low, close] = window.ohlc
      bars.push({
        date: record.date,
        open,
        high,
        low,
        close,
        volume: findVolume(values, window.index, high),
      })
      continue
    }

    // 日付と終値だけ、あるいは終値と出来高だけの並びも受け付ける
    if (values.length === 1) {
      const close = values[0]
      bars.push({ date: record.date, open: close, high: close, low: close, close, volume: 0 })
      continue
    }
    if (values.length === 2 && looksLikeVolume(values[1], values[0])) {
      const close = values[0]
      bars.push({
        date: record.date,
        open: close,
        high: close,
        low: close,
        close,
        volume: values[1],
      })
      continue
    }

    skipped += 1
  }

  bars.sort((a, b) => a.date.localeCompare(b.date))
  return { rows: bars, skipped, error: null }
}

/** SBI証券の取引履歴CSVから読み取った約定1件。 */
export type Execution = {
  date: string
  code: string
  name: string
  side: 'buy' | 'sell'
  shares: number
  price: number
  fee: number
}

const HISTORY_ALIASES = {
  date: ['約定日', '取引日', '日付'],
  code: ['銘柄コード', 'コード', '銘柄コード・ティッカー'],
  name: ['銘柄名', '銘柄'],
  side: ['取引', '売買', '売買区分', '取引区分'],
  shares: ['約定数量', '数量', '株数', '約定株数'],
  price: ['約定単価', '単価', '約定価格'],
  fee: ['手数料/諸経費等', '手数料', '諸経費'],
}

/**
 * SBI証券の「取引履歴」CSVを読み込む。列の並びは出力設定で変わるため、
 * ヘッダー名で列を探す。買い/売りは「取引」列に含まれる文字で判定する。
 */
export function parseTradeHistoryCsv(text: string): ParseResult<Execution> {
  const table = parseCsv(text)
  const headerIndex = table.findIndex(
    (row) => findColumn(row, HISTORY_ALIASES.date) >= 0 && findColumn(row, HISTORY_ALIASES.price) >= 0,
  )
  if (headerIndex < 0) {
    return {
      rows: [],
      skipped: 0,
      error: '約定日と約定単価の列が見つかりませんでした。SBI証券の取引履歴CSVか確認してください。',
    }
  }
  const header = table[headerIndex]
  const columns = {
    date: findColumn(header, HISTORY_ALIASES.date),
    code: findColumn(header, HISTORY_ALIASES.code),
    name: findColumn(header, HISTORY_ALIASES.name),
    side: findColumn(header, HISTORY_ALIASES.side),
    shares: findColumn(header, HISTORY_ALIASES.shares),
    price: findColumn(header, HISTORY_ALIASES.price),
    fee: findColumn(header, HISTORY_ALIASES.fee),
  }

  const rows: Execution[] = []
  let skipped = 0

  for (const row of table.slice(headerIndex + 1)) {
    const date = parseDate(row[columns.date] ?? '')
    const price = parseNumber(row[columns.price] ?? '')
    const shares = parseNumber(row[columns.shares] ?? '')
    const sideText = columns.side >= 0 ? (row[columns.side] ?? '') : ''
    const side: 'buy' | 'sell' | null = sideText.includes('買')
      ? 'buy'
      : sideText.includes('売')
        ? 'sell'
        : null
    if (!date || price === null || shares === null || shares <= 0 || side === null) {
      skipped += 1
      continue
    }
    const rawCode = columns.code >= 0 ? toHalfWidth(row[columns.code] ?? '').trim() : ''
    rows.push({
      date,
      code: rawCode || '----',
      name: (columns.name >= 0 ? row[columns.name] : '')?.trim() || rawCode,
      side,
      shares,
      price,
      fee: (columns.fee >= 0 ? parseNumber(row[columns.fee] ?? '') : 0) ?? 0,
    })
  }

  rows.sort((a, b) => a.date.localeCompare(b.date))
  return {
    rows,
    skipped,
    error: rows.length === 0 ? '約定データが読み取れませんでした。' : null,
  }
}

export type MatchedTrade = {
  code: string
  name: string
  entryDate: string
  entryPrice: number
  shares: number
  exitDate: string | null
  exitPrice: number | null
  fees: number
}

/**
 * 約定履歴を買い→売りのFIFOで突き合わせ、1トレード単位にまとめる。
 * 売り数量が買いより多い場合(信用売りなど)は対応する買いが無い分を捨てる。
 */
export function matchExecutions(executions: Execution[]): MatchedTrade[] {
  const open = new Map<string, { date: string; price: number; shares: number; fee: number }[]>()
  const names = new Map<string, string>()
  const trades: MatchedTrade[] = []

  for (const execution of [...executions].sort((a, b) => a.date.localeCompare(b.date))) {
    names.set(execution.code, execution.name)
    const queue = open.get(execution.code) ?? []
    if (execution.side === 'buy') {
      queue.push({
        date: execution.date,
        price: execution.price,
        shares: execution.shares,
        fee: execution.fee,
      })
      open.set(execution.code, queue)
      continue
    }

    let remaining = execution.shares
    const exitFeePerShare = execution.shares ? execution.fee / execution.shares : 0
    while (remaining > 0 && queue.length > 0) {
      const lot = queue[0]
      const shares = Math.min(remaining, lot.shares)
      const entryFeePerShare = lot.shares ? lot.fee / lot.shares : 0
      trades.push({
        code: execution.code,
        name: names.get(execution.code) ?? execution.code,
        entryDate: lot.date,
        entryPrice: lot.price,
        shares,
        exitDate: execution.date,
        exitPrice: execution.price,
        fees: Math.round((entryFeePerShare + exitFeePerShare) * shares),
      })
      lot.shares -= shares
      lot.fee -= entryFeePerShare * shares
      remaining -= shares
      if (lot.shares <= 0) queue.shift()
    }
    open.set(execution.code, queue)
  }

  for (const [code, queue] of open) {
    for (const lot of queue) {
      if (lot.shares <= 0) continue
      trades.push({
        code,
        name: names.get(code) ?? code,
        entryDate: lot.date,
        entryPrice: lot.price,
        shares: lot.shares,
        exitDate: null,
        exitPrice: null,
        fees: Math.round(lot.fee),
      })
    }
  }

  return trades.sort((a, b) => a.entryDate.localeCompare(b.entryDate))
}
