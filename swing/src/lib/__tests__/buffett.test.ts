import { describe, expect, it } from 'vitest'
import {
  EMPTY_FUNDAMENTALS,
  evaluateFundamentals,
  grahamVerdict,
  type Fundamentals,
} from '../learn/buffett'
import { findTerm } from '../learn/glossary'

const fill = (patch: Partial<Fundamentals>): Fundamentals => ({ ...EMPTY_FUNDAMENTALS, ...patch })

describe('企業チェッカー', () => {
  it('未入力なら点数を出さない', () => {
    const result = evaluateFundamentals(EMPTY_FUNDAMENTALS)
    expect(result.score).toBeNull()
    expect(result.answered).toBe(0)
    expect(result.checks.every((check) => check.verdict === 'unknown')).toBe(true)
  })

  it('バフェットが好む数字を並べると高得点になる', () => {
    const result = evaluateFundamentals(
      fill({
        roe: 18,
        operatingMargin: 20,
        equityRatio: 65,
        epsGrowth: 12,
        debtToProfit: 1.5,
        per: 14,
        fcfPositive: true,
      }),
    )
    expect(result.score).toBe(100)
    expect(result.answered).toBe(7)
    expect(result.summary).toContain('バフェットが好む')
  })

  it('借金が重く利益率が低いと低得点になる', () => {
    const result = evaluateFundamentals(
      fill({
        roe: 4,
        operatingMargin: 2,
        equityRatio: 18,
        epsGrowth: -5,
        debtToProfit: 12,
        per: 40,
        fcfPositive: false,
      }),
    )
    expect(result.score).toBe(0)
    expect(result.summary).toContain('基準からは外れて')
  })

  it('入力した項目だけで採点する', () => {
    const result = evaluateFundamentals(fill({ roe: 18, equityRatio: 60 }))
    expect(result.answered).toBe(2)
    expect(result.score).toBe(100)
    expect(result.summary).toContain('入力が少ない')
  })

  it('境界値の判定', () => {
    const verdictOf = (patch: Partial<Fundamentals>, id: string) =>
      evaluateFundamentals(fill(patch)).checks.find((c) => c.id === id)?.verdict
    expect(verdictOf({ roe: 15 }, 'roe')).toBe('good')
    expect(verdictOf({ roe: 14.9 }, 'roe')).toBe('ok')
    expect(verdictOf({ roe: 9.9 }, 'roe')).toBe('weak')
    expect(verdictOf({ equityRatio: 50 }, 'equity-ratio')).toBe('good')
    expect(verdictOf({ debtToProfit: 3 }, 'debt')).toBe('good')
    expect(verdictOf({ debtToProfit: 6.1 }, 'debt')).toBe('weak')
    // 実質無借金(マイナス)も良い扱いにする
    expect(verdictOf({ debtToProfit: -2 }, 'debt')).toBe('good')
    expect(verdictOf({ per: 0 }, 'per')).toBe('weak')
  })

  it('PERから益回りを、PERとPBRからグレアム指数を出す', () => {
    const result = evaluateFundamentals(fill({ per: 20, pbr: 1.5 }))
    expect(result.earningsYield).toBeCloseTo(5, 6)
    expect(result.grahamNumber).toBeCloseTo(30, 6)
    expect(grahamVerdict(result.grahamNumber)).toBe('ok')
    expect(grahamVerdict(22.5)).toBe('good')
    expect(grahamVerdict(50)).toBe('weak')
    expect(grahamVerdict(null)).toBe('unknown')
  })

  it('どの項目にも用語集の解説がある', () => {
    for (const check of evaluateFundamentals(EMPTY_FUNDAMENTALS).checks) {
      expect(findTerm(check.term), check.id).toBeDefined()
    }
  })
})

describe('サンプル銘柄の企業カルテ', () => {
  it('サンプルごとに狙った財務の性格になっている', async () => {
    const { buildSampleData } = await import('../market/sampleData')
    const score = (code: string) => {
      const stock = buildSampleData().find((s) => s.stock.code === code)?.stock
      expect(stock?.fundamentals, code).toBeDefined()
      return evaluateFundamentals(stock!.fundamentals!).score
    }
    // A: 中身もチャートも良い
    expect(score('SMPL1')).toBeGreaterThanOrEqual(70)
    // C: 財務が弱い
    expect(score('SMPL3')).toBeLessThan(40)
    // E: 業績は良いが株価が高い(PERだけ弱い)
    const expensive = buildSampleData().find((s) => s.stock.code === 'SMPL5')!.stock.fundamentals!
    const result = evaluateFundamentals(expensive)
    expect(result.score).toBeGreaterThanOrEqual(70)
    expect(result.checks.find((c) => c.id === 'per')?.verdict).toBe('weak')
  })
})
