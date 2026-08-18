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
  /** 損切り位置をATRの何倍にするか。 */
  atrMultiple: number
  /** 新規登録時の売買単位。 */
  defaultLot: number
  feeConfig: FeeConfig
  /** エントリー前チェックリスト。自由に書き換えられる。 */
  checklist: string[]
  updatedAt: number
}

export const DEFAULT_CHECKLIST = [
  '日経平均・TOPIXの地合いは買い向きか',
  '決算発表日をまたがないか(またぐなら覚悟しているか)',
  '損切り価格と株数を先に決めたか',
  '上値の節目(直近高値・信用の需給)を確認したか',
  '出来高は十分か(板が薄くないか)',
  '同じテーマの銘柄に偏っていないか',
]

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  capital: 1_000_000,
  riskPercent: 2,
  maxPositionPercent: 30,
  rewardRatio: 2,
  atrMultiple: 2,
  defaultLot: 100,
  feeConfig: DEFAULT_FEE_CONFIG,
  checklist: DEFAULT_CHECKLIST,
  updatedAt: 0,
}
