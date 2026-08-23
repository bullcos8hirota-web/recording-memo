/** 日足1本分の価格データ。date は 'YYYY-MM-DD' 形式。 */
export type Bar = {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

import type { Fundamentals } from '../learn/buffett'

/** 銘柄ごとに保存する財務データ(企業カルテ)。 */
export type StockFundamentals = Fundamentals & {
  /** 決算期などのメモ。 */
  note?: string
  updatedAt: number
}

/** ウォッチリストに登録した銘柄。 */
export type Stock = {
  /** 証券コード。日本株は4桁が基本だが自由入力を許す。 */
  code: string
  name: string
  /** 売買単位。単元株は100、S株(単元未満株)なら1。 */
  lot: number
  /** 自由メモ(テーマ、気づきなど)。 */
  memo?: string
  /** 次回の決算発表日(YYYY-MM-DD)。持ち越しの可否を判断するために使う。 */
  earningsDate?: string | null
  /** 財務データ。入力していない銘柄では未設定。 */
  fundamentals?: StockFundamentals
  /** サンプルデータとして投入した銘柄かどうか。 */
  demo?: boolean
  createdAt: number
}
