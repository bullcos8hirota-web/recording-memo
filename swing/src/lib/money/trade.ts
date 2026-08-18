/** 売買記録。現物買い(long)が中心だが、信用売り(short)も記録できる。 */
export type Trade = {
  id: string
  code: string
  name: string
  side: 'long' | 'short'
  entryDate: string
  entryPrice: number
  shares: number
  /** エントリー時に決めた損切り価格。Rの計算に使う。 */
  stopPrice: number | null
  targetPrice: number | null
  exitDate: string | null
  exitPrice: number | null
  /** 往復の手数料など(円)。 */
  fees: number
  /** エントリー根拠(なぜ買ったか)。 */
  reason: string
  /** 手仕舞い後の振り返り。 */
  review: string
  tags: string[]
  createdAt: number
  updatedAt: number
}

export type TradeResult = {
  closed: boolean
  /** 損益(手数料差引後、税引前)。 */
  profit: number
  profitPercent: number
  /** 損切り幅を1Rとしたときの倍率。損切りを決めていない場合は null。 */
  rMultiple: number | null
  holdingDays: number | null
}

const DAY = 24 * 60 * 60 * 1000

export function tradeValue(trade: Trade): number {
  return trade.entryPrice * trade.shares
}

/** 建玉の損益。price を渡すと含み損益、省略すると確定損益を返す。 */
export function evaluateTrade(trade: Trade, price?: number | null): TradeResult {
  const exitPrice = trade.exitPrice ?? price ?? null
  const closed = trade.exitPrice !== null && trade.exitDate !== null
  if (exitPrice === null) {
    return { closed, profit: 0, profitPercent: 0, rMultiple: null, holdingDays: null }
  }
  const direction = trade.side === 'long' ? 1 : -1
  const gross = (exitPrice - trade.entryPrice) * trade.shares * direction
  const profit = gross - (trade.fees || 0)
  const cost = tradeValue(trade)
  const risk =
    trade.stopPrice === null
      ? null
      : Math.abs(trade.entryPrice - trade.stopPrice) * trade.shares
  const end = trade.exitDate ?? new Date().toISOString().slice(0, 10)
  const holdingDays = Math.max(
    0,
    Math.round((Date.parse(end) - Date.parse(trade.entryDate)) / DAY),
  )
  return {
    closed,
    profit,
    profitPercent: cost ? (profit / cost) * 100 : 0,
    rMultiple: risk && risk > 0 ? profit / risk : null,
    holdingDays: Number.isFinite(holdingDays) ? holdingDays : null,
  }
}

export function isClosed(trade: Trade): boolean {
  return trade.exitPrice !== null && trade.exitDate !== null
}
