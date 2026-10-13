import { weeklyPlan } from '../plan/weekly'
import { tradeFee } from '../money/fees'
import type { Bar, Stock } from '../market/types'
import type { Settings } from '../db/schema'
import type { Trade } from '../money/trade'

/**
 * 過去の値動きに、同じルールをそのまま流す。
 *
 * 3回や5回の実績からは何も分からない。勝率40%の手法でも3連敗は珍しくないので、
 * 「負けたからやめる」の判断材料にはならない。手元には1年分の日足があり、ルールは
 * 完全に機械的なので、過去に同じことをしていたらどうなっていたかは計算できる。
 *
 * 判断そのものは weeklyPlan をそのまま呼ぶ。ここで条件を書き直すと、検証したのは
 * 「このファイルの中のルール」であってアプリのルールではなくなる。
 */

/** 1トレード分の結果。 */
export type BacktestTrade = {
  code: string
  name: string
  entryDate: string
  entryPrice: number
  exitDate: string
  exitPrice: number
  shares: number
  /** 買った時点の損切り価格。1Rの基準。 */
  stopAtEntry: number
  /** 最後に置いていた損切り価格。トレーリングで動いていることがある。 */
  stopAtExit: number
  fees: number
  profit: number
  /** 損切り幅を1としたときの倍率。 */
  rMultiple: number
  /** stop=損切り、trail=引き上げた損切り、end=検証期間の終わりで強制手仕舞い。 */
  reason: 'stop' | 'trail' | 'end'
}

export type EquityPoint = { date: string; value: number }

export type BacktestResult = {
  from: string
  to: string
  /** 判断を行った回数(週数)。 */
  decisions: number
  /** 地合いで新規を止めた週数。 */
  blockedByBreadth: number
  /** 条件を満たす銘柄が無くて何も出さなかった週数。 */
  noCandidate: number
  /** 注文は出したが約定しなかった回数。 */
  ordersExpired: number

  trades: BacktestTrade[]
  wins: number
  losses: number
  winRate: number
  averageWin: number
  averageLoss: number
  /** 平均利益 ÷ 平均損失。1を超えていれば勝ちが大きい。 */
  payoff: number
  /** 1トレードあたりの期待値(円)。 */
  expectancy: number
  maxConsecutiveLosses: number

  initialCapital: number
  totalProfit: number
  returnPercent: number
  /** 資産の山からの最大の落ち込み(円)。 */
  maxDrawdown: number
  maxDrawdownPercent: number
  equity: EquityPoint[]

  /** 同じ期間、同じ銘柄を等金額で買って持ち続けた場合。 */
  benchmark: {
    stocks: number
    profit: number
    returnPercent: number
    /** 途中の最大の落ち込み。 */
    maxDrawdownPercent: number
    equity: EquityPoint[]
  }
}

/** 判定に必要な日足がたまるまで、この本数は何もしない。 */
export const WARMUP_BARS = 80

/**
 * 逆指値の買いが約定する値段。届かなければ null。
 *
 * トリガーを上に飛び越えて始まった日は、トリガー価格では買えない。寄値で買う。
 * ここを「必ずトリガー価格」にすると、検証だけが現実より有利になる。
 */
export function entryFill(bar: Bar, trigger: number): number | null {
  if (bar.high < trigger) return null
  return Math.max(trigger, bar.open)
}

/**
 * 損切りが約定する値段。当たらなければ null。
 *
 * 損切りを下に飛び越えて始まった日は、損切り価格では売れない。寄値で売る。
 * トヨタで実際に起きたことなので、ここを理想化すると負けが小さく出てしまう。
 */
export function stopFill(bar: Bar, stop: number): number | null {
  if (bar.low > stop) return null
  return Math.min(stop, bar.open)
}

const dayMs = 24 * 60 * 60 * 1000

/** その日が属する週の通し番号。月曜始まりで数える。 */
const weekOf = (date: string): number =>
  Math.floor((Date.parse(date) / dayMs + 3) / 7)

/** 建玉を weeklyPlan に渡すための形にする。 */
function asTrade(position: OpenPosition): Trade {
  return {
    id: position.code,
    code: position.code,
    name: position.name,
    side: 'long',
    entryDate: position.entryDate,
    entryPrice: position.entryPrice,
    shares: position.shares,
    stopPrice: position.stopPrice,
    targetPrice: null,
    exitDate: null,
    exitPrice: null,
    fees: 0,
    reason: '',
    review: '',
    tags: [],
    createdAt: 0,
    updatedAt: 0,
  }
}

type OpenPosition = {
  code: string
  name: string
  entryDate: string
  entryPrice: number
  shares: number
  stopPrice: number
  stopAtEntry: number
  entryFee: number
  /** トレーリングで一度でも損切りを上げたか。手仕舞いの理由に出す。 */
  raised: boolean
}

type LiveOrder = {
  code: string
  name: string
  trigger: number
  stopPrice: number
  shares: number
  expiresOn: string
}

export function backtest(input: {
  stocks: Stock[]
  series: Record<string, Bar[]>
  settings: Settings
  /** 判定に必要な日足がたまるまでの本数。既定 80。 */
  warmup?: number
}): BacktestResult | null {
  const { series, settings } = input
  const warmup = input.warmup ?? WARMUP_BARS

  // 決算日と権利確定日は「次回の1件」しか持っていない。過去のある日にそれが
  // 近かったかどうかは再現できないので、検証では見送り条件から外す。実際の運用では
  // この条件でさらに何件か見送るので、ここの結果は少しだけ甘い側に出る。
  const stocks: Stock[] = input.stocks.map((stock) => ({
    ...stock,
    earningsDate: null,
    exRightsDate: null,
    pendingOrder: null,
  }))

  const dates = [...new Set(Object.values(series).flatMap((bars) => bars.map((b) => b.date)))].sort()
  if (dates.length <= warmup + 5) return null

  const barAt = new Map<string, Map<string, Bar>>()
  for (const [code, bars] of Object.entries(series)) {
    barAt.set(code, new Map(bars.map((bar) => [bar.date, bar])))
  }
  const bar = (code: string, date: string): Bar | undefined => barAt.get(code)?.get(date)

  /** その日までの日足。weeklyPlan には未来を見せない。 */
  const sliceTo = (date: string): Record<string, Bar[]> => {
    const out: Record<string, Bar[]> = {}
    for (const [code, bars] of Object.entries(series)) {
      const cut = bars.filter((item) => item.date <= date)
      if (cut.length > 0) out[code] = cut
    }
    return out
  }

  const fee = (amount: number) => tradeFee(amount, settings.feeConfig)

  const initialCapital = settings.capital
  let capital = initialCapital
  const trades: BacktestTrade[] = []
  const equity: EquityPoint[] = []
  let position: OpenPosition | null = null
  let order: LiveOrder | null = null
  let decisions = 0
  let blockedByBreadth = 0
  let noCandidate = 0
  let ordersExpired = 0

  const close = (exitDate: string, exitPrice: number, reason: BacktestTrade['reason']) => {
    const held = position!
    const exitAmount = exitPrice * held.shares
    const fees = held.entryFee + fee(exitAmount)
    const profit = (exitPrice - held.entryPrice) * held.shares - fees
    const risk = (held.entryPrice - held.stopAtEntry) * held.shares
    trades.push({
      code: held.code,
      name: held.name,
      entryDate: held.entryDate,
      entryPrice: held.entryPrice,
      exitDate,
      exitPrice,
      shares: held.shares,
      stopAtEntry: held.stopAtEntry,
      stopAtExit: held.stopPrice,
      fees,
      profit,
      rMultiple: risk > 0 ? profit / risk : 0,
      reason,
    })
    capital += profit
    position = null
  }

  const start = dates[warmup]

  for (let index = warmup; index < dates.length; index += 1) {
    const date = dates[index]

    // 1) 建玉の損切り。寄りで飛び越えたら、損切り価格ではなく寄値で約定する。
    //    トヨタのときに実際に起きたことなので、ここを理想化すると意味がない。
    const open = position
    if (open) {
      const today = bar(open.code, date)
      const exit = today ? stopFill(today, open.stopPrice) : null
      if (exit !== null) close(date, exit, open.raised ? 'trail' : 'stop')
    }

    // 2) 出してある注文の約定。逆指値の買いなので、高値がトリガーに届いたら約定。
    //    上に窓を開けたときは寄値で買う(トリガー価格では買えない)。
    if (!position && order) {
      if (order.expiresOn < date) {
        order = null
        ordersExpired += 1
      } else {
        const today = bar(order.code, date)
        const entryPrice = today ? entryFill(today, order.trigger) : null
        if (today && entryPrice !== null) {
          const filled: OpenPosition = {
            code: order.code,
            name: order.name,
            entryDate: date,
            entryPrice,
            shares: order.shares,
            stopPrice: order.stopPrice,
            stopAtEntry: order.stopPrice,
            entryFee: fee(entryPrice * order.shares),
            raised: false,
          }
          position = filled
          order = null
          // 買ったその日に損切りまで落ちることもある。無かったことにはしない。
          // ただし寄値はもう使えない(すでに買ったあと)ので、損切り価格で約定させる。
          if (today.low <= filled.stopPrice) close(date, filled.stopPrice, 'stop')
        }
      }
    }

    // 3) 週末の判断。実際の運用と同じで、金曜の引け後に次の週の注文を決める。
    if (index < dates.length - 1 && weekOf(dates[index + 1]) !== weekOf(date)) {
      decisions += 1
      const withOrder: Stock[] = stocks.map((stock) =>
        order && stock.code === order.code
          ? {
              ...stock,
              pendingOrder: {
                trigger: order.trigger,
                shares: order.shares,
                stopPrice: order.stopPrice,
                expiresOn: order.expiresOn,
                placedOn: date,
              },
            }
          : stock,
      )

      const plan = weeklyPlan({
        stocks: withOrder,
        series: sliceTo(date),
        trades: position ? [asTrade(position)] : [],
        settings: { ...settings, capital },
        now: new Date(`${date}T15:30:00`),
      })

      // トレーリングの引き上げ
      const raise = plan.positions.find((item) => item.kind === 'raise-stop')
      const holding = position as OpenPosition | null
      if (holding && raise?.raiseTo != null) {
        holding.stopPrice = raise.raiseTo
        holding.raised = true
      }

      if (plan.breadth.blocksNewOrders) blockedByBreadth += 1
      else if (plan.orders.length === 0 && !order && !position) noCandidate += 1

      // 新しい注文。期限は翌週の終わりまで。
      const next = plan.orders[0]
      if (next && !order && !position) {
        const endOfNextWeek =
          dates.filter((d) => weekOf(d) === weekOf(dates[index + 1])).at(-1) ?? dates[index + 1]
        order = {
          code: next.code,
          name: next.name,
          trigger: next.trigger,
          stopPrice: next.stopPrice,
          shares: next.shares,
          expiresOn: endOfNextWeek,
        }
      }

      // 資産の推移。含み損益も入れないと、落ち込みの深さが分からない。
      const mark = holding ? bar(holding.code, date)?.close ?? holding.entryPrice : 0
      const unrealized = holding ? (mark - holding.entryPrice) * holding.shares : 0
      equity.push({ date, value: capital + unrealized })
    }
  }

  // 期間の終わりに残っている建玉は、最後の終値で閉じる。
  const last = dates[dates.length - 1]
  if (position) {
    const final = bar(position.code, last)?.close ?? position.entryPrice
    close(last, final, 'end')
    equity.push({ date: last, value: capital })
  }

  const wins = trades.filter((trade) => trade.profit > 0)
  const losses = trades.filter((trade) => trade.profit <= 0)
  const averageWin = wins.length ? wins.reduce((s, t) => s + t.profit, 0) / wins.length : 0
  const averageLoss = losses.length
    ? Math.abs(losses.reduce((s, t) => s + t.profit, 0) / losses.length)
    : 0

  let streak = 0
  let maxConsecutiveLosses = 0
  for (const trade of trades) {
    streak = trade.profit <= 0 ? streak + 1 : 0
    maxConsecutiveLosses = Math.max(maxConsecutiveLosses, streak)
  }

  const drawdown = (points: EquityPoint[]): { amount: number; percent: number } => {
    let peak = points[0]?.value ?? 0
    let amount = 0
    let percent = 0
    for (const point of points) {
      peak = Math.max(peak, point.value)
      const fall = peak - point.value
      if (fall > amount) amount = fall
      if (peak > 0 && (fall / peak) * 100 > percent) percent = (fall / peak) * 100
    }
    return { amount, percent }
  }

  const totalProfit = capital - initialCapital
  const own = drawdown(equity)

  return {
    from: start,
    to: last,
    decisions,
    blockedByBreadth,
    noCandidate,
    ordersExpired,
    trades,
    wins: wins.length,
    losses: losses.length,
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    averageWin,
    averageLoss,
    payoff: averageLoss > 0 ? averageWin / averageLoss : 0,
    expectancy: trades.length ? totalProfit / trades.length : 0,
    maxConsecutiveLosses,
    initialCapital,
    totalProfit,
    returnPercent: initialCapital > 0 ? (totalProfit / initialCapital) * 100 : 0,
    maxDrawdown: own.amount,
    maxDrawdownPercent: own.percent,
    equity,
    benchmark: buyAndHold({ series, dates: dates.slice(warmup), capital: initialCapital, bar }),
  }
}

/**
 * 同じ期間、同じ銘柄を等金額で買って持ち続けた場合。
 *
 * オルカンではない。手元にあるのは日本株の日足だけなので、比べられるのは
 * 「選ばずに全部持っていたら」まで。それでも、売り買いした意味があったかは分かる。
 */
function buyAndHold(input: {
  series: Record<string, Bar[]>
  dates: string[]
  capital: number
  bar: (code: string, date: string) => Bar | undefined
}): BacktestResult['benchmark'] {
  const { dates, capital, bar } = input
  const first = dates[0]
  const codes = Object.keys(input.series).filter((code) => bar(code, first))
  if (codes.length === 0) {
    return { stocks: 0, profit: 0, returnPercent: 0, maxDrawdownPercent: 0, equity: [] }
  }

  const each = capital / codes.length
  const units = new Map(codes.map((code) => [code, each / bar(code, first)!.close]))

  const equity: EquityPoint[] = []
  for (const date of dates) {
    let value = 0
    for (const code of codes) {
      const close = bar(code, date)?.close
      // その日の値が無い銘柄は、直前の評価額を引きずらずに取得価格で置く。
      value += close != null ? close * units.get(code)! : each
    }
    equity.push({ date, value })
  }

  let peak = equity[0].value
  let maxDrawdownPercent = 0
  for (const point of equity) {
    peak = Math.max(peak, point.value)
    const fall = ((peak - point.value) / peak) * 100
    if (fall > maxDrawdownPercent) maxDrawdownPercent = fall
  }

  const profit = equity[equity.length - 1].value - capital
  return {
    stocks: codes.length,
    profit,
    returnPercent: (profit / capital) * 100,
    maxDrawdownPercent,
    equity,
  }
}
