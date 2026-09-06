import { analyze } from '../market/signals'
import { earningsAlert } from '../market/earnings'
import { chandelierStop, trailingAdvice } from '../money/position'
import { atr as atrSeries } from '../market/indicators'
import { calculatePosition, entryCandidates } from '../money/position'
import { isClosed, type Trade } from '../money/trade'
import type { Bar, Stock } from '../market/types'
import type { Settings } from '../db/schema'

/**
 * 「今週やること」を作る。
 *
 * 点数を並べるだけでは、結局どれを買えばいいのか分からない。毎週の判断は決まった
 * 手順なので、そのままここに書く。相場観ではなく、外せない条件を順に落としていくだけ。
 */

/** 建玉についてやること。 */
export type PositionAction = {
  kind: 'set-stop' | 'raise-stop' | 'hold-stop'
  code: string
  name: string
  /** 今の損切り価格。 */
  stopPrice: number | null
  /** 引き上げ先(kind が raise-stop のときだけ)。 */
  raiseTo: number | null
  shares: number
  entryPrice: number
  /** 据え置く理由。 */
  note: string
  /** 決算・権利落ちの注意。 */
  warnings: string[]
}

/** 新しく出す注文。 */
export type OrderAction = {
  code: string
  name: string
  score: number
  /** 逆指値の買いトリガー。 */
  trigger: number
  stopPrice: number
  shares: number
  /** 1銘柄で取るリスク(円)。 */
  risk: number
  /** 決算日が未登録なら真。飛ぶ危険を消せていない。 */
  earningsUnknown: boolean
}

/** すでに証券会社に出してある注文。 */
export type PendingAction = {
  code: string
  name: string
  trigger: number
  shares: number
  stopPrice: number
  expiresOn: string
  expired: boolean
}

export type Skipped = { code: string; name: string; reason: string }

export type WeeklyPlan = {
  positions: PositionAction[]
  pending: PendingAction[]
  orders: OrderAction[]
  skipped: Skipped[]
  /** 建玉と新規を合わせた想定損失(円)。 */
  totalRisk: number
  /** 何も手を動かさなくていい週か。 */
  nothingToDo: boolean
}

/** 新規は週に何銘柄までか。 */
export const MAX_NEW_ORDERS = 1
/** 建玉と新規を合わせて、資金の何%までリスクを取るか。 */
export const MAX_TOTAL_RISK_PERCENT = 3

const yen = (value: number): string => `${Math.round(value).toLocaleString('ja-JP')}円`

export function weeklyPlan(input: {
  stocks: Stock[]
  series: Record<string, Bar[]>
  trades: Trade[]
  settings: Settings
  now?: Date
}): WeeklyPlan {
  const { stocks, series, settings } = input
  const now = input.now ?? new Date()
  const open = input.trades.filter((trade) => !isClosed(trade))
  const held = new Set(open.map((trade) => trade.code))

  const positions: PositionAction[] = []
  let totalRisk = 0

  for (const trade of open) {
    const stock = stocks.find((item) => item.code === trade.code)
    const bars = series[trade.code] ?? []
    const warnings: string[] = []
    const earnings = earningsAlert(stock?.earningsDate, now)
    if (earnings?.soon) {
      warnings.push(
        `決算発表が${earnings.days}日後です。翌朝は損切り価格を飛び越えて始まることがあります。`,
      )
    }
    const exRights = earningsAlert(stock?.exRightsDate, now)
    if (exRights?.soon) {
      warnings.push(
        `権利確定日が${exRights.days}日後です。翌営業日は配当の分だけ下がるので、その週は損切りを上げません。`,
      )
    }

    if (trade.stopPrice === null) {
      positions.push({
        kind: 'set-stop',
        code: trade.code,
        name: trade.name,
        stopPrice: null,
        raiseTo: null,
        shares: trade.shares,
        entryPrice: trade.entryPrice,
        note: '損切りが決まっていません。先に決めてから、証券会社にも売りの逆指値を出してください。',
        warnings,
      })
      continue
    }

    totalRisk += Math.max(0, trade.entryPrice - trade.stopPrice) * trade.shares

    // トレーリングの目安。権利落ちが近い週は動かさない。
    const since = bars.filter((bar) => bar.date >= trade.entryDate)
    const atr = atrSeries(bars, 14)[bars.length - 1] ?? null
    const trailing =
      since.length >= 3 && atr !== null
        ? chandelierStop(
            Math.max(...since.map((bar) => bar.high)),
            atr,
            settings.atrMultiple + 0.5,
          )
        : null
    const advice = trailingAdvice(trailing, trade.stopPrice, trade.entryPrice)

    if (advice.raiseTo !== null && !exRights?.soon) {
      positions.push({
        kind: 'raise-stop',
        code: trade.code,
        name: trade.name,
        stopPrice: trade.stopPrice,
        raiseTo: advice.raiseTo,
        shares: trade.shares,
        entryPrice: trade.entryPrice,
        note: '買値より上に届きました。ここまで上げれば、この建玉はもう負けません。証券会社の逆指値も訂正してください。',
        warnings,
      })
      continue
    }

    positions.push({
      kind: 'hold-stop',
      code: trade.code,
      name: trade.name,
      stopPrice: trade.stopPrice,
      raiseTo: null,
      shares: trade.shares,
      entryPrice: trade.entryPrice,
      note:
        advice.reason === 'below-entry'
          ? 'トレーリングの目安がまだ買値より下です。詰めても負けが少し小さくなるだけで、普通の押し目で切られやすくなります。'
          : exRights?.soon
            ? '権利落ちが近いので、この週は動かしません。'
            : 'トレーリングの目安が今の損切りより下です。動かしません。',
      warnings,
    })
  }

  // 証券会社に出してある注文。これがある銘柄には、重ねて注文を出させない。
  const pending: PendingAction[] = []
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`
  for (const stock of stocks) {
    const order = stock.pendingOrder
    if (!order) continue
    pending.push({
      code: stock.code,
      name: stock.name,
      trigger: order.trigger,
      shares: order.shares,
      stopPrice: order.stopPrice,
      expiresOn: order.expiresOn,
      expired: order.expiresOn < today,
    })
    totalRisk += Math.max(0, order.trigger - order.stopPrice) * order.shares
  }

  // 新規の候補。落ちた理由は、落ちたぶんだけ残して見せる。
  const skipped: Skipped[] = []
  const candidates: (OrderAction & { volumeOk: boolean })[] = []
  const riskBudget = Math.floor((settings.capital * settings.riskPercent) / 100)

  for (const stock of stocks) {
    if (held.has(stock.code) || stock.pendingOrder) continue
    const bars = series[stock.code] ?? []
    if (bars.length < 30) continue
    const { snapshot, verdict, score } = analyze(bars)
    if (verdict !== 'ready') continue

    const earnings = earningsAlert(stock.earningsDate, now)
    if (earnings?.soon) {
      skipped.push({
        code: stock.code,
        name: stock.name,
        reason: `決算発表が${earnings.days}日後（${stock.earningsDate}）。損切りを飛び越えて始まることがあるので見送ります。`,
      })
      continue
    }

    const trigger = entryCandidates({
      close: snapshot.close,
      high: snapshot.high,
      high20: snapshot.high20,
    })[0]?.price
    if (!trigger || snapshot.atr14 === null) continue
    const stopPrice = Math.round(trigger - snapshot.atr14 * settings.atrMultiple)

    const sizing = calculatePosition({
      capital: settings.capital,
      riskPercent: settings.riskPercent,
      maxPositionPercent: settings.maxPositionPercent,
      entryPrice: trigger,
      stopPrice,
      lot: stock.lot,
      feeConfig: settings.feeConfig,
    })
    if (sizing.shares <= 0) {
      skipped.push({
        code: stock.code,
        name: stock.name,
        reason:
          sizing.limitedBy === 'position-cap'
            ? `1銘柄への投入上限では${stock.lot}株を買えません。`
            : `${stock.lot}株買うと許容損失(${yen(riskBudget)})を超えます。値動きが大きすぎます。`,
      })
      continue
    }

    candidates.push({
      code: stock.code,
      name: stock.name,
      score,
      trigger,
      stopPrice,
      shares: sizing.shares,
      risk: (trigger - stopPrice) * sizing.shares,
      earningsUnknown: !stock.earningsDate,
      // 反発の日に買いが入っているか。同点のときの並べ替えに使う。
      volumeOk:
        snapshot.volumeAvg20 !== null && snapshot.volumeAvg20 > 0
          ? snapshot.volume >= snapshot.volumeAvg20
          : false,
    })
  }

  candidates.sort((a, b) => b.score - a.score || Number(b.volumeOk) - Number(a.volumeOk))

  const orders: OrderAction[] = []
  const riskCap = (settings.capital * MAX_TOTAL_RISK_PERCENT) / 100
  for (const candidate of candidates) {
    const { volumeOk: _volumeOk, ...order } = candidate
    if (orders.length >= MAX_NEW_ORDERS) {
      skipped.push({
        code: order.code,
        name: order.name,
        reason: `新規は週${MAX_NEW_ORDERS}銘柄までにしています。来週また見ます。`,
      })
      continue
    }
    if (totalRisk + order.risk > riskCap) {
      skipped.push({
        code: order.code,
        name: order.name,
        reason: `建玉と合わせたリスクが資金の${MAX_TOTAL_RISK_PERCENT}%(${yen(riskCap)})を超えます。`,
      })
      continue
    }
    orders.push(order)
    totalRisk += order.risk
  }

  const nothingToDo =
    orders.length === 0 &&
    positions.every((item) => item.kind === 'hold-stop' && item.warnings.length === 0) &&
    pending.every((item) => !item.expired)

  return { positions, pending, orders, skipped, totalRisk, nothingToDo }
}
