import { atr } from './indicators'
import type { Bar } from './types'

/**
 * 疑う閾値は、その銘柄の普段の値幅(ATR)の何倍か。
 * 値動きの荒い銘柄で毎回警告が出ても意味がないので、銘柄ごとに変える。
 */
const ATR_MULTIPLE = 2.5
/** ATRが出せないとき、または小さすぎるときの下限(%)。 */
const FLOOR_PERCENT = 6

export type SuspiciousJump = { date: string; changeRate: number }

/**
 * 取り込む前に、つながりのおかしい日を探す。
 * 別の銘柄のデータを貼ってしまうと、価格帯が近い銘柄どうしでは気づけない。
 * 前日比で見ると、その継ぎ目が跳ねるので分かる。
 */
export function suspiciousJumps(existing: Bar[], incoming: Bar[]): SuspiciousJump[] {
  const map = new Map(existing.map((bar) => [bar.date, bar]))
  for (const bar of incoming) map.set(bar.date, bar)
  const merged = [...map.values()].sort((a, b) => a.date.localeCompare(b.date))

  const incomingDates = new Set(incoming.map((bar) => bar.date))
  const limit = dailyLimit(merged)
  const jumps: SuspiciousJump[] = []

  for (let i = 1; i < merged.length; i += 1) {
    const previous = merged[i - 1]
    const bar = merged[i]
    // 取り込む日が絡む継ぎ目だけを見る。前からあるデータは今さら直せない。
    if (!incomingDates.has(bar.date) && !incomingDates.has(previous.date)) continue
    if (previous.close <= 0) continue
    const changeRate = ((bar.close - previous.close) / previous.close) * 100
    if (Math.abs(changeRate) > limit) jumps.push({ date: bar.date, changeRate })
  }

  return jumps
}

/** その銘柄の普段の値幅から、疑い始める1日の変化率(%)を決める。 */
function dailyLimit(bars: Bar[]): number {
  const last = bars[bars.length - 1]
  if (!last || last.close <= 0) return FLOOR_PERCENT
  const atrValue = atr(bars, 14).at(-1)
  if (atrValue === null || atrValue === undefined) return FLOOR_PERCENT
  return Math.max(FLOOR_PERCENT, (atrValue / last.close) * 100 * ATR_MULTIPLE)
}
