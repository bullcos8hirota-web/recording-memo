import { parsePriceCsv } from './csv'
import { parseQuoteLines, type QuoteLine } from './quickUpdate'
import type { Bar, Stock } from './types'

/**
 * 貼り付けられた文字列が何なのかを判定する。取り込み口を1つにするため、
 * 「日付が入っていれば1銘柄の時系列」「入っていなければ複数銘柄のその日の値」と読み分ける。
 */
export type PasteResult =
  | { kind: 'series'; bars: Bar[]; skipped: number }
  | { kind: 'quotes'; rows: QuoteLine[] }
  | { kind: 'empty'; reason: string | null }

export function analyzePaste(text: string, stocks: Stock[], date: string): PasteResult {
  if (text.trim() === '') return { kind: 'empty', reason: null }

  // 日付を含むなら時系列として読む
  const series = parsePriceCsv(text)
  if (series.rows.length > 0) {
    return { kind: 'series', bars: series.rows, skipped: series.skipped }
  }

  // 日付が無ければ「コード + 価格」の一覧として読む
  const quotes = parseQuoteLines(text, stocks, date)
  if (quotes.some((row) => row.bar !== null && row.code !== null)) {
    return { kind: 'quotes', rows: quotes }
  }

  return {
    kind: 'empty',
    reason:
      '読み取れませんでした。日付と株価が並んだ表か、「コード 株価」の行を貼り付けてください。',
  }
}
