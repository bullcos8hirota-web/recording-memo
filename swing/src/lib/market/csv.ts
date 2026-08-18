import type { Bar } from './types'

/** RFC4180風のCSVパーサ。引用符とCRLF、BOMを扱う。 */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, '')
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
    } else if (char === ',' || char === '\t') {
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

/** 「2026/8/18」「2026-08-18」「20260818」「2026年8月18日」を YYYY-MM-DD にする。 */
export function parseDate(value: string): string | null {
  if (!value) return null
  const text = toHalfWidth(value.trim())
  const ymd = text.match(/^(\d{4})[/\-年.](\d{1,2})[/\-月.](\d{1,2})/)
  if (ymd) return iso(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]))
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

  return {
    rows: deduped,
    skipped,
    error: deduped.length === 0 ? '読み取れる行がありませんでした。' : null,
  }
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
