/**
 * 東証の呼値(値段の刻み)。TOPIX500採用銘柄はより細かい刻みが使われるため、
 * ここでは通常銘柄の刻みを目安として扱う。逆指値の価格を丸めるのに使う。
 */
const TICK_TABLE: { upTo: number; tick: number }[] = [
  { upTo: 3_000, tick: 1 },
  { upTo: 5_000, tick: 5 },
  { upTo: 30_000, tick: 10 },
  { upTo: 50_000, tick: 50 },
  { upTo: 300_000, tick: 100 },
  { upTo: 500_000, tick: 500 },
  { upTo: 3_000_000, tick: 1_000 },
  { upTo: 5_000_000, tick: 5_000 },
  { upTo: Number.POSITIVE_INFINITY, tick: 10_000 },
]

export function tickSize(price: number): number {
  return TICK_TABLE.find((row) => price <= row.upTo)?.tick ?? 1
}

/** 呼値に合わせて価格を丸める。損切りは切り下げ、利確は切り上げに使い分ける。 */
export function roundToTick(
  price: number,
  mode: 'nearest' | 'down' | 'up' = 'nearest',
): number {
  if (!Number.isFinite(price) || price <= 0) return 0
  const tick = tickSize(price)
  const units = price / tick
  const rounded =
    mode === 'down'
      ? Math.floor(units)
      : mode === 'up'
        ? Math.ceil(units)
        : Math.round(units)
  return Number((rounded * tick).toFixed(4))
}
