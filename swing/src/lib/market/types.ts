/** 日足1本分の価格データ。date は 'YYYY-MM-DD' 形式。 */
export type Bar = {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/** ウォッチリストに登録した銘柄。 */
export type Stock = {
  /** 証券コード。日本株は4桁が基本だが自由入力を許す。 */
  code: string
  name: string
  /** 売買単位。単元株は100、S株(単元未満株)なら1。 */
  lot: number
  /** 自由メモ(決算日、テーマなど)。 */
  memo?: string
  /** サンプルデータとして投入した銘柄かどうか。 */
  demo?: boolean
  createdAt: number
}
