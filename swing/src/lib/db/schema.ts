import { DEFAULT_FEE_CONFIG, type FeeConfig } from '../money/fees'
import type { Bar, Stock } from '../market/types'

export type { Stock, Bar }
export type { Trade } from '../money/trade'

/** 銘柄ごとの日足データ。まとめて1レコードで持つ。 */
export type PriceSeries = {
  code: string
  bars: Bar[]
  updatedAt: number
}

/** 資金管理の設定。アプリ全体で1件だけ持つ。 */
export type Settings = {
  id: 'app'
  /** スイングに使う運用資金(円)。 */
  capital: number
  /** 1トレードの許容損失(運用資金に対する%)。 */
  riskPercent: number
  /** 1銘柄あたりの投入上限(運用資金に対する%)。 */
  maxPositionPercent: number
  /** 損切り幅に対する利確幅の倍率。 */
  rewardRatio: number
  /**
   * 出口の決め方。'target' は利確価格を置く。'trailing' は利確を置かず、
   * 損切りを上げていって当たるまで持つ。
   */
  exitStyle: 'target' | 'trailing'
  /** 損切り位置をATRの何倍にするか。 */
  atrMultiple: number
  /** 新規登録時の売買単位。 */
  defaultLot: number
  feeConfig: FeeConfig
  updatedAt: number
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  capital: 1_000_000,
  riskPercent: 2,
  maxPositionPercent: 30,
  rewardRatio: 2,
  exitStyle: 'trailing',
  atrMultiple: 2,
  defaultLot: 100,
  feeConfig: DEFAULT_FEE_CONFIG,
  updatedAt: 0,
}
