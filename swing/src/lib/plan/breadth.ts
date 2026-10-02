import { analyze } from '../market/signals'
import type { Bar, Stock } from '../market/types'

/**
 * 相場全体の地合い。
 *
 * 1銘柄ずつ点数を見ていると、「この銘柄が悪い」のか「相場全体が悪い」のかが区別できない。
 * 押し目買いは、上げ相場の中の一時的な下げを買う手法なので、全体が下げている間は
 * 何を買っても損切りに当たる。だから銘柄を選ぶ前に、そもそも買う場面かを先に決める。
 *
 * 見るのは「何割の銘柄が25日線より上にいるか」だけ。指数を別で取ってくる必要がなく、
 * 自分が実際に買う可能性のある銘柄だけで数えられるので、手元のデータで完結する。
 */

export type BreadthLevel = 'good' | 'mixed' | 'poor' | 'unknown'

export type Breadth = {
  level: BreadthLevel
  /** 判定できた銘柄数。 */
  total: number
  /** 25日線より上にいる銘柄数。 */
  above: number
  /** above が total の何%か(0〜100)。 */
  abovePercent: number
  /** 「条件が揃っている」と判定された銘柄数。 */
  ready: number
  /** 下降トレンドと判定された銘柄数。 */
  falling: number
  /** 数字をそのまま並べた1行。 */
  summary: string
  /** その数字をどう受け取るか。 */
  note: string
  /** 新規の注文を止めるか。 */
  blocksNewOrders: boolean
}

/** これより銘柄が少ないと、割合を見ても意味がない。 */
export const MIN_SAMPLE = 10
/** 25日線より上がこの割合を切ったら、下げ相場とみなして新規を止める。 */
export const POOR_PERCENT = 40
/** これを超えていれば、普通に買っていい。 */
export const GOOD_PERCENT = 60

export const BREADTH_LABEL: Record<BreadthLevel, string> = {
  good: '良い',
  mixed: '強弱が分かれている',
  poor: '悪い',
  unknown: '判定できない',
}

/**
 * 監視リスト全体から地合いを数える。
 *
 * 基準に 25日線を使うのは、個々の銘柄判定でも同じ線を見ているから。別の物差しを
 * 持ち込むと、「アプリは買えと言うのに地合いは悪いと言う」が起きる。
 */
export function marketBreadth(input: {
  stocks: Stock[]
  series: Record<string, Bar[]>
}): Breadth {
  let total = 0
  let above = 0
  let ready = 0
  let falling = 0

  for (const stock of input.stocks) {
    const bars = input.series[stock.code] ?? []
    if (bars.length < 30) continue
    const { snapshot, verdict, trend } = analyze(bars)
    if (snapshot.sma25 === null) continue
    total += 1
    if (snapshot.close > snapshot.sma25) above += 1
    if (verdict === 'ready') ready += 1
    if (trend === 'down') falling += 1
  }

  const abovePercent = total > 0 ? Math.round((above / total) * 100) : 0

  if (total < MIN_SAMPLE) {
    return {
      level: 'unknown',
      total,
      above,
      abovePercent,
      ready,
      falling,
      summary: `判定できた銘柄が${total}しかありません。`,
      note: `${MIN_SAMPLE}銘柄以上ないと割合を見ても意味がないので、地合いでは止めません。`,
      blocksNewOrders: false,
    }
  }

  const level: BreadthLevel =
    abovePercent < POOR_PERCENT ? 'poor' : abovePercent < GOOD_PERCENT ? 'mixed' : 'good'

  // 割合そのものは画面では大きく別に出すので、ここでは実数を並べる。
  const summary =
    `${total}銘柄中${above}銘柄が25日線より上。` +
    `条件が揃っているのは${ready}銘柄、下降トレンドは${falling}銘柄。`

  const note =
    level === 'poor'
      ? '全体が下げています。押し目買いは下げ相場では機能しないので、今週は新規を出しません。' +
        `25日線より上が${POOR_PERCENT}%を超えたら再開します。`
      : level === 'mixed'
        ? '上と下が混ざっています。新規は出しますが、普段より外れやすい場面です。'
        : '多くの銘柄が25日線の上にいます。押し目買いが働く場面です。'

  return {
    level,
    total,
    above,
    abovePercent,
    ready,
    falling,
    summary,
    note,
    blocksNewOrders: level === 'poor',
  }
}
