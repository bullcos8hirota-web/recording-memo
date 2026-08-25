/** 日足1本分の価格データ。date は 'YYYY-MM-DD' 形式。 */
export type Bar = {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}


/** 証券会社に出してあり、まだ約定していない注文。 */
export type PendingOrder = {
  /** 逆指値のトリガー価格。 */
  trigger: number
  shares: number
  /** 約定したら置く損切り価格。 */
  stopPrice: number
  /** 注文の期限(YYYY-MM-DD)。これを過ぎたら失効している。 */
  expiresOn: string
  /** 注文を出した日(YYYY-MM-DD)。 */
  placedOn: string
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
  /** 次回の権利確定日(YYYY-MM-DD)。翌営業日に配当の分だけ機械的に下がる。 */
  exRightsDate?: string | null
  /** 証券会社に出してある注文。約定するか取り消すまで残る。 */
  pendingOrder?: PendingOrder | null
  /** サンプルデータとして投入した銘柄かどうか。 */
  demo?: boolean
  createdAt: number
}
