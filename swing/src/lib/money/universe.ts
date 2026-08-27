import type { Settings } from '../db/schema'

/** これ未満は「動かない銘柄」として外す、1日の値幅(終値に対する%)。 */
export const MIN_ATR_RATE = 2.5
/** 値がさ株を避ける下限。呼値が粗くなる低位株も別途避ける。 */
export const MIN_PRICE = 1_000

export type Universe = {
  /** 1単元の代金が1銘柄上限に収まる株価の上限。 */
  priceCapByPosition: number
  /** 1単元の損切り幅が許容損失に収まるATRの上限(円)。 */
  atrCap: number
  /** ATR上限と「動く銘柄」の条件を両立できる株価の上限。 */
  priceCapByAtr: number
  /** 実際に狙う株価の上限。 */
  priceCap: number
  /** 1日の平均売買代金の下限(円)。建玉が板に対して大きくなりすぎない水準。 */
  turnoverFloor: number
}

/**
 * 資金と許容損失から、探すべき銘柄の範囲を出す。
 * 「買えない銘柄を調べる時間」をなくすための計算で、良し悪しの判定ではない。
 */
export function universeFor(settings: Settings, lot = settings.defaultLot): Universe {
  const budget = (settings.capital * settings.riskPercent) / 100
  const positionCap = (settings.capital * settings.maxPositionPercent) / 100

  const priceCapByPosition = Math.floor(positionCap / lot)
  const atrCap = Math.floor(budget / (settings.atrMultiple * lot))
  const priceCapByAtr = Math.floor(atrCap / (MIN_ATR_RATE / 100))

  return {
    priceCapByPosition,
    atrCap,
    priceCapByAtr,
    priceCap: Math.min(priceCapByPosition, priceCapByAtr),
    // 建玉が1日の売買代金の1%を超えると、板を動かしてしまう。
    turnoverFloor: Math.ceil((priceCapByPosition * lot * 100) / 100_000_000) * 100_000_000,
  }
}
