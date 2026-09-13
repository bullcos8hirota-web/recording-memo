import { MIN_ATR_RATE, MIN_PRICE, universeFor } from '../money/universe'
import type { MarketRow } from '../market/jquants'
import type { Settings } from '../db/schema'

/**
 * 市場全体から、この資金で扱える銘柄を拾う。
 *
 * 探す範囲は好みではなく、資金と許容損失から計算で決まる。買えない銘柄を眺める時間を
 * なくすのが目的で、良し悪しの判定はしない(それは取り込んだあとのスコアの仕事)。
 */

export type Candidate = {
  code: string
  close: number
  turnover: number
  /** その日の値幅が終値の何%か。荒さの粗い目安。 */
  rangeRate: number
}

export type ScreenResult = {
  candidates: Candidate[]
  /** 何段目でどれだけ落ちたか。0件だったときに理由を言えるようにする。 */
  counts: {
    all: number
    priced: number
    liquid: number
    moving: number
  }
}

/**
 * 1日分の全銘柄から候補を絞る。
 *
 * 1日の値幅だけでATRの代わりにするのは粗いが、ここは履歴を取りに行く銘柄を
 * 数十件まで減らすためのふるい。正確な判定は履歴を取ってから行う。
 */
export function screenMarket(
  rows: MarketRow[],
  options: { settings: Settings; exclude?: Iterable<string>; limit?: number },
): ScreenResult {
  const universe = universeFor(options.settings)
  const exclude = new Set(options.exclude ?? [])
  const limit = options.limit ?? 60

  const priced = rows.filter(
    (row) =>
      !exclude.has(row.code) &&
      !exclude.has(row.code.slice(0, 4)) &&
      row.close >= MIN_PRICE &&
      row.close <= universe.priceCap,
  )
  const liquid = priced.filter((row) => row.turnover >= universe.turnoverFloor)
  const moving = liquid.filter(
    (row) => row.close > 0 && ((row.high - row.low) / row.close) * 100 >= MIN_ATR_RATE,
  )

  const candidates = moving
    .map((row) => ({
      code: row.code,
      close: row.close,
      turnover: row.turnover,
      rangeRate: ((row.high - row.low) / row.close) * 100,
    }))
    // 売買代金の大きい順。同じ条件なら、出入りしやすいほうから調べる。
    .sort((a, b) => b.turnover - a.turnover)
    .slice(0, limit)

  return {
    candidates,
    counts: {
      all: rows.length,
      priced: priced.length,
      liquid: liquid.length,
      moving: moving.length,
    },
  }
}

/**
 * J-Quantsの銘柄コードは5桁(末尾0)で返る。アプリでは4桁で扱っているので合わせる。
 */
export function shortCode(code: string): string {
  return code.length === 5 && code.endsWith('0') ? code.slice(0, 4) : code
}
