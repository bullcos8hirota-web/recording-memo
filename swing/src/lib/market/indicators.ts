import type { Bar } from './types'

/**
 * テクニカル指標の計算。
 * どの関数も入力と同じ長さの配列を返し、値が確定していない期間は null を入れる。
 * こうしておくと配列の添字がそのままローソク足の添字になり、描画や判定でズレない。
 */
export type Series = (number | null)[]

const filled = (length: number): Series => new Array<number | null>(length).fill(null)

export function closes(bars: Bar[]): number[] {
  return bars.map((b) => b.close)
}

/** 単純移動平均。 */
export function sma(values: number[], period: number): Series {
  const out = filled(values.length)
  if (period <= 0) return out
  let sum = 0
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

/** 指数移動平均。最初の period 本の単純平均を初期値にする。 */
export function ema(values: number[], period: number): Series {
  const out = filled(values.length)
  if (period <= 0 || values.length < period) return out
  const k = 2 / (period + 1)
  let seed = 0
  for (let i = 0; i < period; i += 1) seed += values[i]
  let prev = seed / period
  out[period - 1] = prev
  for (let i = period; i < values.length; i += 1) {
    prev = values[i] * k + prev * (1 - k)
    out[i] = prev
  }
  return out
}

/** RSI(Wilder方式)。 */
export function rsi(values: number[], period = 14): Series {
  const out = filled(values.length)
  if (values.length <= period) return out
  let gain = 0
  let loss = 0
  for (let i = 1; i <= period; i += 1) {
    const diff = values[i] - values[i - 1]
    if (diff >= 0) gain += diff
    else loss -= diff
  }
  let avgGain = gain / period
  let avgLoss = loss / period
  out[period] = toRsi(avgGain, avgLoss)
  for (let i = period + 1; i < values.length; i += 1) {
    const diff = values[i] - values[i - 1]
    const up = diff > 0 ? diff : 0
    const down = diff < 0 ? -diff : 0
    avgGain = (avgGain * (period - 1) + up) / period
    avgLoss = (avgLoss * (period - 1) + down) / period
    out[i] = toRsi(avgGain, avgLoss)
  }
  return out
}

function toRsi(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

export type Macd = { macd: Series; signal: Series; histogram: Series }

/** MACD(既定は12/26/9)。 */
export function macd(
  values: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): Macd {
  const fastEma = ema(values, fast)
  const slowEma = ema(values, slow)
  const line = filled(values.length)
  const lineValues: number[] = []
  const lineIndex: number[] = []
  for (let i = 0; i < values.length; i += 1) {
    const f = fastEma[i]
    const s = slowEma[i]
    if (f === null || s === null) continue
    line[i] = f - s
    lineValues.push(f - s)
    lineIndex.push(i)
  }
  const signalCompact = ema(lineValues, signalPeriod)
  const signal = filled(values.length)
  const histogram = filled(values.length)
  for (let j = 0; j < lineIndex.length; j += 1) {
    const value = signalCompact[j]
    if (value === null) continue
    const i = lineIndex[j]
    signal[i] = value
    const macdValue = line[i]
    if (macdValue !== null) histogram[i] = macdValue - value
  }
  return { macd: line, signal, histogram }
}

export type Bollinger = { middle: Series; upper: Series; lower: Series }

/** ボリンジャーバンド(既定は20日・±2σ)。 */
export function bollinger(values: number[], period = 20, k = 2): Bollinger {
  const middle = sma(values, period)
  const upper = filled(values.length)
  const lower = filled(values.length)
  for (let i = period - 1; i < values.length; i += 1) {
    const mean = middle[i]
    if (mean === null) continue
    let variance = 0
    for (let j = i - period + 1; j <= i; j += 1) {
      variance += (values[j] - mean) ** 2
    }
    const sd = Math.sqrt(variance / period)
    upper[i] = mean + k * sd
    lower[i] = mean - k * sd
  }
  return { middle, upper, lower }
}

/** True Range。前日終値がない初日は高値-安値。 */
export function trueRange(bars: Bar[]): number[] {
  return bars.map((bar, i) => {
    if (i === 0) return bar.high - bar.low
    const prevClose = bars[i - 1].close
    return Math.max(
      bar.high - bar.low,
      Math.abs(bar.high - prevClose),
      Math.abs(bar.low - prevClose),
    )
  })
}

/** ATR(Wilder方式)。損切り幅の目安に使う。 */
export function atr(bars: Bar[], period = 14): Series {
  const out = filled(bars.length)
  if (bars.length < period) return out
  const tr = trueRange(bars)
  let sum = 0
  for (let i = 0; i < period; i += 1) sum += tr[i]
  let prev = sum / period
  out[period - 1] = prev
  for (let i = period; i < bars.length; i += 1) {
    prev = (prev * (period - 1) + tr[i]) / period
    out[i] = prev
  }
  return out
}

/** 直近 period 本の最高値(当日を含む)。 */
export function highest(bars: Bar[], period: number): Series {
  return rollingExtreme(
    bars.map((b) => b.high),
    period,
    Math.max,
  )
}

/** 直近 period 本の最安値(当日を含む)。 */
export function lowest(bars: Bar[], period: number): Series {
  return rollingExtreme(
    bars.map((b) => b.low),
    period,
    Math.min,
  )
}

function rollingExtreme(
  values: number[],
  period: number,
  pick: (a: number, b: number) => number,
): Series {
  const out = filled(values.length)
  for (let i = period - 1; i < values.length; i += 1) {
    let value = values[i - period + 1]
    for (let j = i - period + 2; j <= i; j += 1) value = pick(value, values[j])
    out[i] = value
  }
  return out
}

/** 移動平均からの乖離率(%)。 */
export function deviationRate(price: number, average: number | null): number | null {
  if (average === null || average === 0) return null
  return ((price - average) / average) * 100
}

/** 直近 n 本の傾き(1本あたりの変化量)。トレンドの向き判定に使う。 */
export function slope(series: Series, index: number, span = 5): number | null {
  const now = series[index]
  const before = series[index - span]
  if (now === null || before === null || now === undefined || before === undefined) {
    return null
  }
  return (now - before) / span
}

/** a が b を下から上に抜けた本数を探す。抜けていなければ null。 */
export function crossedAbove(a: Series, b: Series, index: number, within = 3): number | null {
  for (let back = 0; back < within; back += 1) {
    const i = index - back
    if (i <= 0) break
    const a0 = a[i - 1]
    const b0 = b[i - 1]
    const a1 = a[i]
    const b1 = b[i]
    if (a0 === null || b0 === null || a1 === null || b1 === null) continue
    if (a0 <= b0 && a1 > b1) return back
  }
  return null
}

/** a が b を上から下に抜けた本数を探す。 */
export function crossedBelow(a: Series, b: Series, index: number, within = 3): number | null {
  return crossedAbove(b, a, index, within)
}
