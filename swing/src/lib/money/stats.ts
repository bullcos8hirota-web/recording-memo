import { evaluateTrade, isClosed, tradeValue, type Trade } from './trade'

export type TradeStats = {
  total: number
  wins: number
  losses: number
  winRate: number
  totalProfit: number
  averageWin: number
  averageLoss: number
  /** 平均利益 ÷ 平均損失。1を超えるほど「利大損小」。 */
  payoffRatio: number
  /** 総利益 ÷ 総損失。1.0未満は負け越し。 */
  profitFactor: number
  /** 1トレードあたりの期待値(円)。 */
  expectancy: number
  /** 1トレードあたりの期待値(R倍)。損切りを記録したトレードのみ。 */
  expectancyR: number | null
  /** 累積損益の最大落ち込み(円)。 */
  maxDrawdown: number
  maxConsecutiveLosses: number
  averageHoldingDays: number | null
  bestTrade: number
  worstTrade: number
}

export const EMPTY_STATS: TradeStats = {
  total: 0,
  wins: 0,
  losses: 0,
  winRate: 0,
  totalProfit: 0,
  averageWin: 0,
  averageLoss: 0,
  payoffRatio: 0,
  profitFactor: 0,
  expectancy: 0,
  expectancyR: null,
  maxDrawdown: 0,
  maxConsecutiveLosses: 0,
  averageHoldingDays: null,
  bestTrade: 0,
  worstTrade: 0,
}

/** 手仕舞い済みトレードから成績を集計する。 */
export function summarize(trades: Trade[]): TradeStats {
  const closed = trades
    .filter(isClosed)
    .slice()
    .sort((a, b) => (a.exitDate ?? '').localeCompare(b.exitDate ?? ''))
  if (closed.length === 0) return EMPTY_STATS

  let grossWin = 0
  let grossLoss = 0
  let wins = 0
  let losses = 0
  let cumulative = 0
  let peak = 0
  let maxDrawdown = 0
  let streak = 0
  let maxStreak = 0
  let holdingSum = 0
  let holdingCount = 0
  let rSum = 0
  let rCount = 0
  let best = Number.NEGATIVE_INFINITY
  let worst = Number.POSITIVE_INFINITY

  for (const trade of closed) {
    const result = evaluateTrade(trade)
    const profit = result.profit
    if (profit >= 0) {
      wins += 1
      grossWin += profit
      streak = 0
    } else {
      losses += 1
      grossLoss += -profit
      streak += 1
      maxStreak = Math.max(maxStreak, streak)
    }
    cumulative += profit
    peak = Math.max(peak, cumulative)
    maxDrawdown = Math.max(maxDrawdown, peak - cumulative)
    if (result.holdingDays !== null) {
      holdingSum += result.holdingDays
      holdingCount += 1
    }
    if (result.rMultiple !== null) {
      rSum += result.rMultiple
      rCount += 1
    }
    best = Math.max(best, profit)
    worst = Math.min(worst, profit)
  }

  const total = closed.length
  return {
    total,
    wins,
    losses,
    winRate: (wins / total) * 100,
    totalProfit: grossWin - grossLoss,
    averageWin: wins ? grossWin / wins : 0,
    averageLoss: losses ? grossLoss / losses : 0,
    payoffRatio: losses && wins ? grossWin / wins / (grossLoss / losses) : 0,
    profitFactor: grossLoss ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    expectancy: (grossWin - grossLoss) / total,
    expectancyR: rCount ? rSum / rCount : null,
    maxDrawdown,
    maxConsecutiveLosses: maxStreak,
    averageHoldingDays: holdingCount ? holdingSum / holdingCount : null,
    bestTrade: best === Number.NEGATIVE_INFINITY ? 0 : best,
    worstTrade: worst === Number.POSITIVE_INFINITY ? 0 : worst,
  }
}

/** 累積損益の推移。資産曲線の描画に使う。 */
export function equityCurve(trades: Trade[]): { date: string; equity: number }[] {
  const closed = trades
    .filter(isClosed)
    .slice()
    .sort((a, b) => (a.exitDate ?? '').localeCompare(b.exitDate ?? ''))
  let equity = 0
  return closed.map((trade) => {
    equity += evaluateTrade(trade).profit
    return { date: trade.exitDate ?? '', equity }
  })
}

/** 建玉が使っている資金の合計。 */
export function openExposure(trades: Trade[]): number {
  return trades.filter((t) => !isClosed(t)).reduce((sum, t) => sum + tradeValue(t), 0)
}
