/**
 * 売買手数料の計算。SBI証券は「ゼロ革命」の条件を満たすと国内株式の
 * 売買手数料が0円になるため既定は無料。プランを使っている場合に備えて
 * 段階テーブルも編集できるようにしてある(金額は設定画面で変更する前提)。
 */
export type FeeTier = { upTo: number; fee: number }

export type FeeConfig = {
  mode: 'free' | 'tiered'
  /** 約定代金の上限と手数料(税込)の組。upTo は昇順。 */
  tiers: FeeTier[]
}

/** 参考値。実際の手数料はSBI証券の最新の料金体系を確認して設定する。 */
export const STANDARD_PLAN_TIERS: FeeTier[] = [
  { upTo: 50_000, fee: 55 },
  { upTo: 100_000, fee: 99 },
  { upTo: 200_000, fee: 115 },
  { upTo: 500_000, fee: 275 },
  { upTo: 1_000_000, fee: 535 },
  { upTo: 1_500_000, fee: 640 },
  { upTo: 30_000_000, fee: 1_013 },
  { upTo: Number.POSITIVE_INFINITY, fee: 1_070 },
]

export const DEFAULT_FEE_CONFIG: FeeConfig = { mode: 'free', tiers: STANDARD_PLAN_TIERS }

/** 片道分の手数料。 */
export function tradeFee(amount: number, config: FeeConfig): number {
  if (config.mode === 'free' || amount <= 0) return 0
  const tier = config.tiers.find((t) => amount <= t.upTo)
  return tier?.fee ?? config.tiers[config.tiers.length - 1]?.fee ?? 0
}

/** 往復(買い+売り)の手数料。 */
export function roundTripFee(
  entryAmount: number,
  exitAmount: number,
  config: FeeConfig,
): number {
  return tradeFee(entryAmount, config) + tradeFee(exitAmount, config)
}

/** 譲渡益にかかる税率(所得税15% + 復興特別所得税0.315% + 住民税5%)。 */
export const CAPITAL_GAIN_TAX_RATE = 0.20315

/** 利益が出た場合の概算税額。特定口座(源泉徴収あり)の目安。 */
export function capitalGainTax(profit: number): number {
  return profit > 0 ? Math.floor(profit * CAPITAL_GAIN_TAX_RATE) : 0
}
