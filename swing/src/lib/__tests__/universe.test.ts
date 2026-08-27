import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../db/schema'
import { universeFor } from '../money/universe'

const settings = { ...DEFAULT_SETTINGS, capital: 2_000_000, riskPercent: 1, maxPositionPercent: 30 }

describe('universeFor', () => {
  it('資金200万・1%・上限30%なら、株価4,000円まで', () => {
    const universe = universeFor(settings)
    expect(universe.priceCapByPosition).toBe(6_000) // 60万円 ÷ 100株
    expect(universe.atrCap).toBe(100) // 2万円 ÷ (2×100株)
    expect(universe.priceCapByAtr).toBe(4_000) // ATR100円が2.5%になる株価
    expect(universe.priceCap).toBe(4_000)
  })

  it('資金が増えれば範囲も広がる', () => {
    const universe = universeFor({ ...settings, capital: 10_000_000 })
    expect(universe.atrCap).toBe(500)
    expect(universe.priceCap).toBe(20_000)
  })

  it('許容損失を上げるとATRの上限が上がる', () => {
    expect(universeFor({ ...settings, riskPercent: 2 }).atrCap).toBe(200)
  })
})
