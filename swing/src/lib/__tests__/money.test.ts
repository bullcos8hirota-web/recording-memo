import { describe, expect, it } from 'vitest'
import {
  affordability,
  buildExitPlan,
  calculatePosition,
  entryCandidates,
  stopCandidates,
} from '../money/position'
import { DEFAULT_FEE_CONFIG, STANDARD_PLAN_TIERS, capitalGainTax, tradeFee } from '../money/fees'
import { roundToTick, tickSize } from '../money/tick'
import { evaluateTrade } from '../money/trade'
import { equityCurve, summarize } from '../money/stats'
import type { Trade } from '../money/trade'

const trade = (patch: Partial<Trade> = {}): Trade => ({
  id: patch.id ?? Math.random().toString(16).slice(2),
  code: '0000',
  name: 'テスト',
  side: 'long',
  entryDate: '2026-01-05',
  entryPrice: 1000,
  shares: 100,
  stopPrice: 950,
  targetPrice: 1100,
  exitDate: null,
  exitPrice: null,
  fees: 0,
  reason: '',
  review: '',
  tags: [],
  createdAt: 0,
  updatedAt: 0,
  ...patch,
})

describe('tick', () => {
  it('価格帯ごとに刻みが変わる', () => {
    expect(tickSize(1500)).toBe(1)
    expect(tickSize(4000)).toBe(5)
    expect(tickSize(12000)).toBe(10)
  })

  it('切り下げ・切り上げを選べる', () => {
    expect(roundToTick(4002, 'down')).toBe(4000)
    expect(roundToTick(4002, 'up')).toBe(4005)
  })
})

describe('fees', () => {
  it('既定はゼロ革命想定で0円', () => {
    expect(tradeFee(500_000, DEFAULT_FEE_CONFIG)).toBe(0)
  })

  it('段階手数料では約定代金の階段で決まる', () => {
    const config = { mode: 'tiered' as const, tiers: STANDARD_PLAN_TIERS }
    expect(tradeFee(49_000, config)).toBe(55)
    expect(tradeFee(150_000, config)).toBe(115)
    expect(tradeFee(90_000_000, config)).toBe(1_070)
  })

  it('利益にだけ税金がかかる', () => {
    expect(capitalGainTax(100_000)).toBe(20_315)
    expect(capitalGainTax(-50_000)).toBe(0)
  })
})

describe('calculatePosition', () => {
  const base = {
    capital: 1_000_000,
    riskPercent: 2,
    maxPositionPercent: 100,
    lot: 100,
    feeConfig: DEFAULT_FEE_CONFIG,
  }

  it('許容損失を超えない株数を単元単位で返す', () => {
    const result = calculatePosition({ ...base, entryPrice: 1000, stopPrice: 950 })
    // 許容損失2万円 ÷ 1株50円 = 400株
    expect(result.shares).toBe(400)
    expect(result.riskAmount).toBe(20_000)
    expect(result.riskRatio).toBeCloseTo(2, 6)
    expect(result.limitedBy).toBe('risk')
  })

  it('1銘柄あたりの上限で頭打ちになる', () => {
    const result = calculatePosition({
      ...base,
      maxPositionPercent: 20,
      entryPrice: 1000,
      stopPrice: 950,
    })
    expect(result.shares).toBe(200)
    expect(result.limitedBy).toBe('position-cap')
  })

  it('損切りがエントリーより上なら発注できない', () => {
    const result = calculatePosition({ ...base, entryPrice: 1000, stopPrice: 1000 })
    expect(result.shares).toBe(0)
    expect(result.error).toContain('損切り価格')
  })

  it('単元で買うとリスク超過になる場合は理由を返す', () => {
    const result = calculatePosition({
      ...base,
      capital: 100_000,
      riskPercent: 1,
      entryPrice: 8_000,
      stopPrice: 7_500,
    })
    expect(result.shares).toBe(0)
    expect(result.error).toContain('S株')
  })

  it('投入上限で1単元も買えない場合はその理由を返す', () => {
    const result = calculatePosition({
      ...base,
      maxPositionPercent: 30,
      entryPrice: 3_170,
      stopPrice: 3_020,
    })
    expect(result.shares).toBe(0)
    expect(result.limitedBy).toBe('position-cap')
    expect(result.error).toContain('投入上限')
  })

  it('手数料も想定損失に含める', () => {
    const config = { mode: 'tiered' as const, tiers: STANDARD_PLAN_TIERS }
    const result = calculatePosition({ ...base, entryPrice: 1000, stopPrice: 950, feeConfig: config })
    expect(result.riskAmount).toBeGreaterThan(20_000)
  })
})

describe('buildExitPlan', () => {
  it('損切り幅の倍数で利確目標を置く', () => {
    const plan = buildExitPlan(1000, 950, 2)
    expect(plan.riskPerShare).toBe(50)
    expect(plan.target).toBe(1100)
    expect(plan.rewardRatio).toBeCloseTo(2, 6)
    expect(plan.riskPercent).toBeCloseTo(5, 6)
  })

  it('呼値に合わせて丸める', () => {
    const plan = buildExitPlan(4002, 3888, 2)
    expect(plan.entry % 5).toBe(0)
    expect(plan.stop % 5).toBe(0)
    expect(plan.target % 5).toBe(0)
  })
})

describe('stopCandidates', () => {
  it('エントリーより下の候補だけ返す', () => {
    const candidates = stopCandidates({
      entry: 1000,
      atr: 30,
      low5: 960,
      sma25: 1050,
      atrMultiple: 2,
    })
    expect(candidates.map((c) => c.id)).toEqual(['atr', 'low5'])
    expect(candidates.every((c) => c.price < 1000)).toBe(true)
  })
})

describe('evaluateTrade', () => {
  it('手仕舞い済みなら損益とR倍が出る', () => {
    const result = evaluateTrade(trade({ exitDate: '2026-01-15', exitPrice: 1100, fees: 500 }))
    expect(result.profit).toBe(9_500)
    expect(result.rMultiple).toBeCloseTo(9_500 / 5_000, 6)
    expect(result.holdingDays).toBe(10)
    expect(result.closed).toBe(true)
  })

  it('保有中は現在値を渡すと含み損益になる', () => {
    const result = evaluateTrade(trade(), 900)
    expect(result.profit).toBe(-10_000)
    expect(result.closed).toBe(false)
  })

  it('信用売りは値下がりで利益になる', () => {
    const result = evaluateTrade(trade({ side: 'short', exitDate: '2026-01-10', exitPrice: 900 }))
    expect(result.profit).toBe(10_000)
  })
})

describe('summarize', () => {
  const trades = [
    trade({ id: 'a', exitDate: '2026-01-10', exitPrice: 1100 }), // +10,000
    trade({ id: 'b', exitDate: '2026-01-20', exitPrice: 950 }), // -5,000
    trade({ id: 'c', exitDate: '2026-01-30', exitPrice: 900 }), // -10,000
    trade({ id: 'd', exitDate: '2026-02-10', exitPrice: 1200 }), // +20,000
    trade({ id: 'e' }), // 保有中は集計に入れない
  ]

  it('勝率と損益を集計する', () => {
    const stats = summarize(trades)
    expect(stats.total).toBe(4)
    expect(stats.wins).toBe(2)
    expect(stats.winRate).toBe(50)
    expect(stats.totalProfit).toBe(15_000)
    expect(stats.profitFactor).toBeCloseTo(30_000 / 15_000, 6)
    expect(stats.expectancy).toBeCloseTo(3_750, 6)
  })

  it('累積損益の落ち込みを最大ドローダウンとして測る', () => {
    const stats = summarize(trades)
    expect(stats.maxDrawdown).toBe(15_000)
    expect(stats.maxConsecutiveLosses).toBe(2)
  })

  it('資産曲線は手仕舞い日の順に積み上がる', () => {
    expect(equityCurve(trades).map((p) => p.equity)).toEqual([10_000, 5_000, -5_000, 15_000])
  })

  it('記録がなければ空の成績を返す', () => {
    expect(summarize([]).total).toBe(0)
  })
})

describe('表示の整形', () => {
  it('0を「-0円」と書かない', async () => {
    const { yen, signedYen, percent } = await import('../format')
    expect(yen(-0)).toBe('0円')
    expect(yen(-0.4)).toBe('0円')
    expect(signedYen(-0)).toBe('0円')
    expect(percent(-0)).toBe('0.0%')
  })
})

describe('entryCandidates', () => {
  it('直近の高値の少し上を先頭に出す', () => {
    const list = entryCandidates({ close: 2916, high: 2930, high20: 2900 })
    expect(list[0]).toMatchObject({ id: 'breakout' })
    expect(list[0].price).toBeGreaterThan(2930)
    // 20日高値が直近の高値より下なら候補に出さない
    expect(list.some((item) => item.id === 'high20')).toBe(false)
    expect(list.at(-1)).toMatchObject({ id: 'close', price: 2916 })
  })

  it('20日高値が上にあるときは、その少し上も候補にする', () => {
    const list = entryCandidates({ close: 2916, high: 2930, high20: 3000 })
    expect(list.map((item) => item.id)).toEqual(['breakout', 'high20', 'close'])
    expect(list[1].price).toBeGreaterThan(3000)
  })
})

describe('affordability', () => {
  const base = { lot: 100, capital: 2_000_000, riskPercent: 1, maxPositionPercent: 30, atrMultiple: 2 }

  it('値動きが穏やかな中価格帯なら買える', () => {
    expect(affordability({ ...base, close: 1_415, atr: 45 })).toEqual({ ok: true })
  })

  it('損切り幅が許容損失を超えるなら買えない', () => {
    // 3,932円 / ATR159 は1単元で31,800円のリスクになる(許容は20,000円)
    expect(affordability({ ...base, close: 3_932, atr: 159 })).toEqual({ ok: false, reason: 'risk' })
  })

  it('1単元の代金が1銘柄上限を超えるなら買えない', () => {
    expect(affordability({ ...base, close: 8_599, atr: 10 })).toEqual({
      ok: false,
      reason: 'position',
    })
  })

  it('ATRが出ていなければ判定しない', () => {
    expect(affordability({ ...base, close: 1_415, atr: null })).toEqual({ ok: true })
  })
})
