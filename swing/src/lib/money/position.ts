import { tradeFee, type FeeConfig } from './fees'
import { roundToTick } from './tick'

export type SizingInput = {
  /** 運用資金(円)。 */
  capital: number
  /** 1トレードで許容する損失の割合(%)。2%なら 2。 */
  riskPercent: number
  /** 1銘柄に投じる上限(運用資金に対する%)。 */
  maxPositionPercent: number
  entryPrice: number
  stopPrice: number
  /** 売買単位。単元株なら100、S株なら1。 */
  lot: number
  feeConfig: FeeConfig
}

export type SizingResult = {
  /** 1株あたりの想定損失(円)。 */
  riskPerShare: number
  /** 許容損失額(円)。 */
  riskBudget: number
  /** 発注できる株数(売買単位に丸めた後)。 */
  shares: number
  /** 必要資金(手数料込み)。 */
  cost: number
  /** 実際に取るリスク額(手数料込み・往復想定)。 */
  riskAmount: number
  /** 運用資金に対する実リスク(%)。 */
  riskRatio: number
  /** 株数を決めた制約。 */
  limitedBy: 'risk' | 'position-cap' | 'none'
  /** 発注できない理由。 */
  error: string | null
}

/**
 * 「1回の負けで資金の何%までしか失わない」を守る株数を求める。
 * スイングトレードで最初に決めるべきはここで、エントリー価格ではない。
 */
export function calculatePosition(input: SizingInput): SizingResult {
  const { capital, riskPercent, maxPositionPercent, entryPrice, lot, feeConfig } = input
  const stopPrice = input.stopPrice
  const riskPerShare = entryPrice - stopPrice
  const riskBudget = Math.floor((capital * riskPercent) / 100)
  const empty: SizingResult = {
    riskPerShare,
    riskBudget,
    shares: 0,
    cost: 0,
    riskAmount: 0,
    riskRatio: 0,
    limitedBy: 'none',
    error: null,
  }

  if (capital <= 0) return { ...empty, error: '運用資金を設定してください。' }
  if (entryPrice <= 0) return { ...empty, error: 'エントリー価格を入力してください。' }
  if (riskPerShare <= 0) {
    return { ...empty, error: '損切り価格はエントリー価格より下に置いてください。' }
  }
  if (riskBudget <= 0) return { ...empty, error: '許容損失が0円です。リスク%を上げてください。' }

  const unit = Math.max(1, Math.floor(lot) || 1)
  const byRisk = Math.floor(riskBudget / riskPerShare / unit) * unit
  const capAmount = (capital * maxPositionPercent) / 100
  const byCap = Math.floor(capAmount / entryPrice / unit) * unit
  const shares = Math.max(0, Math.min(byRisk, byCap))

  if (shares === 0) {
    // 買えない理由が「リスク超過」か「1銘柄の上限」かで打ち手が変わるので、分けて伝える。
    if (byCap === 0 && byRisk > 0) {
      return {
        ...empty,
        limitedBy: 'position-cap',
        error: `1銘柄への投入上限(資金の${maxPositionPercent}% = ${Math.floor(capAmount).toLocaleString('ja-JP')}円)では ${unit}株(${Math.ceil(unit * entryPrice).toLocaleString('ja-JP')}円)を買えません。上限を上げるか、S株(単元未満株)を検討してください。`,
      }
    }
    const need = Math.ceil(riskPerShare * unit)
    return {
      ...empty,
      limitedBy: 'risk',
      error: `${unit}株買うと ${need.toLocaleString('ja-JP')}円のリスクになり、許容損失(${riskBudget.toLocaleString('ja-JP')}円)を超えます。損切り幅を狭めるか、S株(単元未満株)を検討してください。`,
    }
  }

  const entryAmount = shares * entryPrice
  const exitAmount = shares * stopPrice
  const fees = tradeFee(entryAmount, feeConfig) + tradeFee(exitAmount, feeConfig)
  const riskAmount = riskPerShare * shares + fees

  return {
    riskPerShare,
    riskBudget,
    shares,
    cost: entryAmount + tradeFee(entryAmount, feeConfig),
    riskAmount,
    riskRatio: (riskAmount / capital) * 100,
    limitedBy: byCap < byRisk ? 'position-cap' : 'risk',
    error: null,
  }
}

export type ExitPlan = {
  entry: number
  stop: number
  target: number
  /** 損切りまでの値幅(円)と%。 */
  riskPerShare: number
  riskPercent: number
  rewardPerShare: number
  rewardPercent: number
  rewardRatio: number
}

/**
 * エントリー・損切り・利確をまとめた売買プラン。価格は呼値に丸める。
 * 損切りは切り下げ(余裕を持たせる)、利確は切り上げにする。
 */
export function buildExitPlan(
  entryPrice: number,
  stopPrice: number,
  rewardRatio: number,
): ExitPlan {
  const entry = roundToTick(entryPrice, 'nearest')
  const stop = roundToTick(stopPrice, 'down')
  const riskPerShare = Math.max(0, entry - stop)
  const target = roundToTick(entry + riskPerShare * rewardRatio, 'up')
  const rewardPerShare = Math.max(0, target - entry)
  return {
    entry,
    stop,
    target,
    riskPerShare,
    riskPercent: entry ? (riskPerShare / entry) * 100 : 0,
    rewardPerShare,
    rewardPercent: entry ? (rewardPerShare / entry) * 100 : 0,
    rewardRatio: riskPerShare ? rewardPerShare / riskPerShare : 0,
  }
}

/**
 * エントリー価格の候補。証券会社に入れる注文の値段はここで決まる。
 * 「上に抜けたら買う」置き方が基本なので、直近の高値より少し上を先頭に出す。
 */
export function entryCandidates(options: {
  close: number
  high: number
  high20: number | null
}): { id: string; label: string; price: number; note: string }[] {
  const { close, high, high20 } = options
  const candidates: { id: string; label: string; price: number; note: string }[] = []

  candidates.push({
    id: 'breakout',
    label: '直近の高値の少し上',
    price: roundToTick(high * 1.003, 'up'),
    note: '上に抜けたときだけ買う置き方。逆指値で出す。',
  })
  if (high20 !== null && high20 > high) {
    candidates.push({
      id: 'high20',
      label: '20日高値の少し上',
      price: roundToTick(high20 * 1.003, 'up'),
      note: '1か月の高値を更新したら買う置き方。より慎重だが、買値は高くなる。',
    })
  }
  candidates.push({
    id: 'close',
    label: '前回の終値',
    price: roundToTick(close, 'nearest'),
    note: '寄り付きで成行、または終値あたりの指値で買う置き方。',
  })

  return candidates.filter((candidate) => candidate.price > 0)
}

/**
 * 損切り価格の候補。ATR基準は値動きの荒さに合わせて自動で広くなる。
 */
export function stopCandidates(options: {
  entry: number
  atr: number | null
  low5: number | null
  sma25: number | null
  atrMultiple: number
}): { id: string; label: string; price: number; note: string }[] {
  const { entry, atr, low5, sma25, atrMultiple } = options
  const candidates: { id: string; label: string; price: number; note: string }[] = []
  if (atr !== null && atr > 0) {
    candidates.push({
      id: 'atr',
      label: `ATR×${atrMultiple}`,
      price: roundToTick(entry - atr * atrMultiple, 'down'),
      note: '日々の値動きの範囲に対して十分な余裕を取る置き方。',
    })
  }
  if (low5 !== null) {
    candidates.push({
      id: 'low5',
      label: '直近5日安値の少し下',
      price: roundToTick(low5 * 0.995, 'down'),
      note: '安値を割ったらシナリオ崩れ、と判断する置き方。',
    })
  }
  if (sma25 !== null && sma25 < entry) {
    candidates.push({
      id: 'sma25',
      label: '25日線の少し下',
      price: roundToTick(sma25 * 0.98, 'down'),
      note: 'トレンドの支えを割ったら撤退する置き方。',
    })
  }
  return candidates.filter((c) => c.price > 0 && c.price < entry)
}

/** トレーリングストップ(シャンデリアエグジット)。含み益が乗ってから使う。 */
export function chandelierStop(
  highestSinceEntry: number,
  atrValue: number,
  multiple = 2.5,
): number {
  return roundToTick(highestSinceEntry - atrValue * multiple, 'down')
}
