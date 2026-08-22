import {
  atr,
  bollinger,
  closes,
  crossedAbove,
  deviationRate,
  highest,
  lowest,
  macd,
  rsi,
  sma,
  slope,
} from './indicators'
import type { Series } from './indicators'
import type { Bar } from './types'

/** 銘柄1つ分の指標スナップショット(最新足の値)。 */
export type Snapshot = {
  date: string
  close: number
  /** その日の高値・安値。逆指値の位置を決めるときに使う。 */
  high: number
  low: number
  prevClose: number | null
  changeRate: number | null
  volume: number
  sma5: number | null
  sma25: number | null
  sma75: number | null
  rsi14: number | null
  macd: number | null
  macdSignal: number | null
  macdHistogram: number | null
  bbUpper: number | null
  bbLower: number | null
  atr14: number | null
  /** ATRが終値の何%か。値動きの荒さの目安。 */
  atrRate: number | null
  /** 25日移動平均からの乖離率(%)。 */
  deviation25: number | null
  /** 直近20日高値(前日まで)。ブレイクアウト判定に使う。 */
  high20: number | null
  /** 直近20日安値(前日まで)。 */
  low20: number | null
  /** 直近5日安値。損切り位置の候補。 */
  low5: number | null
  volumeAvg20: number | null
  /** 出来高が20日平均の何倍か。 */
  volumeRatio: number | null
}

export type SignalTone = 'bull' | 'bear' | 'info'

export type Signal = {
  id: string
  label: string
  detail: string
  tone: SignalTone
  /** スコアへの寄与(プラスは買い方向、マイナスは見送り方向)。 */
  score: number
}

export type Verdict = 'watch' | 'ready' | 'neutral' | 'avoid'

export type Analysis = {
  snapshot: Snapshot
  signals: Signal[]
  /** 0〜100。50が中立。スイングの買い場としての魅力度。 */
  score: number
  verdict: Verdict
  trend: 'up' | 'down' | 'range'
  /** 判定に必要な本数が足りているか。 */
  enoughBars: boolean
}

export const MIN_BARS = 80

const at = (series: Series, i: number): number | null => {
  const value = series[i]
  return value === undefined ? null : value
}

/** 最新足を基準に指標を計算する。index を渡せば過去日の再現もできる。 */
export function buildSnapshot(bars: Bar[], index = bars.length - 1): Snapshot {
  const price = closes(bars)
  const volumes = bars.map((b) => b.volume)
  const bb = bollinger(price, 20, 2)
  const macdResult = macd(price)
  const sma5 = sma(price, 5)
  const sma25 = sma(price, 25)
  const sma75 = sma(price, 75)
  const atr14 = atr(bars, 14)
  const high20 = highest(bars.slice(0, index), 20)
  const low20 = lowest(bars.slice(0, index), 20)
  const low5 = lowest(bars, 5)
  const volumeAvg20 = sma(volumes, 20)

  const bar = bars[index]
  const prevClose = index > 0 ? bars[index - 1].close : null
  const avgVolume = at(volumeAvg20, index)
  const atrValue = at(atr14, index)

  return {
    date: bar.date,
    close: bar.close,
    high: bar.high,
    low: bar.low,
    prevClose,
    changeRate: prevClose ? ((bar.close - prevClose) / prevClose) * 100 : null,
    volume: bar.volume,
    sma5: at(sma5, index),
    sma25: at(sma25, index),
    sma75: at(sma75, index),
    rsi14: at(rsi(price, 14), index),
    macd: at(macdResult.macd, index),
    macdSignal: at(macdResult.signal, index),
    macdHistogram: at(macdResult.histogram, index),
    bbUpper: at(bb.upper, index),
    bbLower: at(bb.lower, index),
    atr14: atrValue,
    atrRate: atrValue === null ? null : (atrValue / bar.close) * 100,
    deviation25: deviationRate(bar.close, at(sma25, index)),
    high20: high20.length ? at(high20, high20.length - 1) : null,
    low20: low20.length ? at(low20, low20.length - 1) : null,
    low5: at(low5, index),
    volumeAvg20: avgVolume,
    // 終値だけを入れた日は出来高が0になる。0を「薄商い」と読むと誤判定になるので、
    // 平均は取れていても当日の出来高が無い場合は「不明」として扱う。
    volumeRatio: avgVolume && bar.volume > 0 ? bar.volume / avgVolume : null,
  }
}

/**
 * スイングトレード(数日〜数週間)の目線で、買いの根拠と警戒材料を洗い出す。
 * 売買を指示するものではなく、チャートから読み取れる事実を並べるだけ。
 */
export function analyze(bars: Bar[], index = bars.length - 1): Analysis {
  const snapshot = buildSnapshot(bars, index)
  const enoughBars = bars.length >= MIN_BARS
  const price = closes(bars)
  const sma5 = sma(price, 5)
  const sma25 = sma(price, 25)
  const macdResult = macd(price)
  const signals: Signal[] = []

  const { close, sma25: ma25, sma75: ma75, rsi14, atr14 } = snapshot
  const ma25Slope = slope(sma25, index, 5)

  const trend: Analysis['trend'] =
    ma25 !== null && ma75 !== null && close > ma25 && ma25 > ma75
      ? 'up'
      : ma25 !== null && ma75 !== null && close < ma25 && ma25 < ma75
        ? 'down'
        : 'range'

  if (trend === 'up') {
    signals.push({
      id: 'trend-up',
      label: '上昇トレンド',
      detail: '終値 > 25日線 > 75日線。順張りしやすい並び。',
      tone: 'bull',
      score: 14,
    })
  } else if (trend === 'down') {
    signals.push({
      id: 'trend-down',
      label: '下降トレンド',
      detail: '終値 < 25日線 < 75日線。買いは逆行しやすい。',
      tone: 'bear',
      score: -18,
    })
  }

  if (ma25Slope !== null && ma25 !== null) {
    const perDay = (ma25Slope / ma25) * 100
    if (perDay > 0.1) {
      signals.push({
        id: 'ma25-rising',
        label: '25日線が上向き',
        detail: `直近5日で1日あたり ${perDay.toFixed(2)}% 上昇。`,
        tone: 'bull',
        score: 8,
      })
    } else if (perDay < -0.1) {
      signals.push({
        id: 'ma25-falling',
        label: '25日線が下向き',
        detail: `直近5日で1日あたり ${perDay.toFixed(2)}% 低下。`,
        tone: 'bear',
        score: -8,
      })
    }
  }

  const golden = crossedAbove(sma5, sma25, index, 3)
  if (golden !== null) {
    signals.push({
      id: 'golden-cross',
      label: 'ゴールデンクロス',
      detail:
        golden === 0
          ? '本日5日線が25日線を上抜け。'
          : `${golden}日前に5日線が25日線を上抜け。`,
      tone: 'bull',
      score: 12,
    })
  }
  const dead = crossedAbove(sma25, sma5, index, 3)
  if (dead !== null) {
    signals.push({
      id: 'dead-cross',
      label: 'デッドクロス',
      detail: `${dead === 0 ? '本日' : `${dead}日前に`}5日線が25日線を下抜け。`,
      tone: 'bear',
      score: -12,
    })
  }

  // 押し目: 上昇トレンド中に25日線まで下げてきて、その付近で下げ止まっている状態。
  if (trend === 'up' && snapshot.deviation25 !== null) {
    const dev = snapshot.deviation25
    if (dev >= -3 && dev <= 3) {
      const bar = bars[index]
      const rebounding = bar.close > bar.open || (snapshot.low5 !== null && bar.low <= snapshot.low5 * 1.005 && bar.close > bar.low)
      signals.push({
        id: 'pullback',
        label: '25日線まで押し目',
        detail: `25日線との乖離 ${dev.toFixed(1)}%。${rebounding ? '当日は下げ止まりの形。' : 'まだ反発は確認できない。'}`,
        tone: 'bull',
        score: rebounding ? 16 : 9,
      })
    }
  }

  // ブレイクアウト: 直近20日高値(前日まで)を終値で更新。
  if (snapshot.high20 !== null && close > snapshot.high20) {
    const ratio = snapshot.volumeRatio
    const withVolume = ratio !== null && ratio >= 1.5
    signals.push({
      id: 'breakout',
      label: '20日高値ブレイク',
      detail: `直近20日高値 ${Math.round(snapshot.high20).toLocaleString('ja-JP')}円を終値で更新。${
        ratio === null
          ? '出来高が入っていないため、勢いの裏付けは確認できない。'
          : withVolume
            ? '出来高も平均の1.5倍以上。'
            : '出来高の伴いは弱い。'
      }`,
      tone: 'bull',
      score: withVolume ? 18 : 10,
    })
  }

  if (snapshot.low20 !== null && close < snapshot.low20) {
    signals.push({
      id: 'breakdown',
      label: '20日安値割れ',
      detail: '直近20日安値を終値で下回った。下落継続に警戒。',
      tone: 'bear',
      score: -16,
    })
  }

  const macdCross = crossedAbove(macdResult.macd, macdResult.signal, index, 3)
  if (macdCross !== null) {
    signals.push({
      id: 'macd-cross',
      label: 'MACDが好転',
      detail: `${macdCross === 0 ? '本日' : `${macdCross}日前に`}MACDがシグナルを上抜け。`,
      tone: 'bull',
      score: 10,
    })
  }

  if (rsi14 !== null) {
    if (rsi14 < 30) {
      signals.push({
        id: 'rsi-oversold',
        label: 'RSIが売られすぎ',
        detail: `RSI ${rsi14.toFixed(1)}。反発狙いの水準だが、下落中は下げ続けることもある。`,
        tone: trend === 'down' ? 'info' : 'bull',
        score: trend === 'down' ? 2 : 8,
      })
    } else if (rsi14 > 75) {
      signals.push({
        id: 'rsi-overbought',
        label: 'RSIが買われすぎ',
        detail: `RSI ${rsi14.toFixed(1)}。高値掴みになりやすい。`,
        tone: 'bear',
        score: -10,
      })
    }
  }

  if (snapshot.deviation25 !== null && snapshot.deviation25 > 15) {
    signals.push({
      id: 'overheat',
      label: '25日線から上に離れすぎ',
      detail: `乖離 +${snapshot.deviation25.toFixed(1)}%。押し目を待ちたい水準。`,
      tone: 'bear',
      score: -12,
    })
  }

  if (snapshot.volumeRatio !== null && snapshot.volumeRatio < 0.6) {
    signals.push({
      id: 'low-volume',
      label: '出来高が細い',
      detail: `20日平均の ${(snapshot.volumeRatio * 100).toFixed(0)}%。板が薄く不利な約定になりやすい。`,
      tone: 'bear',
      score: -6,
    })
  }

  if (atr14 !== null && snapshot.atrRate !== null && snapshot.atrRate < 1.2) {
    signals.push({
      id: 'low-volatility',
      label: '値動きが小さい',
      detail: `ATRは終値の ${snapshot.atrRate.toFixed(1)}%。数日で値幅が取りにくい。`,
      tone: 'info',
      score: -4,
    })
  }

  const raw = signals.reduce((total, signal) => total + signal.score, 50)
  const score = Math.max(0, Math.min(100, Math.round(raw)))
  const verdict: Verdict = !enoughBars
    ? 'neutral'
    : score >= 75
      ? 'ready'
      : score >= 60
        ? 'watch'
        : score <= 35
          ? 'avoid'
          : 'neutral'

  return { snapshot, signals, score, verdict, trend, enoughBars }
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  ready: '条件が揃っている',
  watch: '監視したい',
  neutral: '様子見',
  avoid: '手を出しにくい',
}
