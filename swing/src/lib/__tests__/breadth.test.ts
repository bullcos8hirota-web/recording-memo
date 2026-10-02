import { describe, expect, it } from 'vitest'
import { marketBreadth, MIN_SAMPLE, POOR_PERCENT } from '../plan/breadth'
import { weeklyPlan } from '../plan/weekly'
import { buildSampleData } from '../market/sampleData'
import { DEFAULT_SETTINGS } from '../db/schema'
import type { Bar, Stock } from '../market/types'

/** 一直線に上げる足。終値は必ず25日線より上になる。 */
const rising = (count = 120, start = 1_000): Bar[] =>
  Array.from({ length: count }, (_, i) => {
    const close = start + i * 10
    return {
      date: new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10),
      open: close - 5,
      high: close + 5,
      low: close - 8,
      close,
      volume: 1_000_000,
    }
  })

/** 一直線に下げる足。終値は必ず25日線より下になる。 */
const falling = (count = 120, start = 3_000): Bar[] =>
  rising(count, 0)
    .map((bar, i) => {
      const close = start - i * 10
      return { ...bar, open: close + 5, high: close + 8, low: close - 5, close }
    })
    .slice(0, count)

const stock = (code: string): Stock => ({
  code,
  name: `銘柄${code}`,
  lot: 100,
  createdAt: 1,
})

/** up 銘柄が上げ、down 銘柄が下げている監視リストを作る。 */
const market = (up: number, down: number) => {
  const stocks: Stock[] = []
  const series: Record<string, Bar[]> = {}
  for (let i = 0; i < up; i += 1) {
    stocks.push(stock(`UP${i}`))
    series[`UP${i}`] = rising()
  }
  for (let i = 0; i < down; i += 1) {
    stocks.push(stock(`DOWN${i}`))
    series[`DOWN${i}`] = falling()
  }
  return { stocks, series }
}

describe('marketBreadth', () => {
  it('25日線より上の銘柄数と割合を数える', () => {
    const result = marketBreadth(market(8, 12))
    expect(result.total).toBe(20)
    expect(result.above).toBe(8)
    expect(result.abovePercent).toBe(40)
  })

  it(`25日線より上が${POOR_PERCENT}%を切ったら、新規を止める`, () => {
    const result = marketBreadth(market(2, 18))
    expect(result.abovePercent).toBe(10)
    expect(result.level).toBe('poor')
    expect(result.blocksNewOrders).toBe(true)
    expect(result.note).toContain('新規を出しません')
  })

  it('ちょうど境目は止めない(下回ったときだけ止める)', () => {
    const result = marketBreadth(market(8, 12))
    expect(result.abovePercent).toBe(POOR_PERCENT)
    expect(result.level).toBe('mixed')
    expect(result.blocksNewOrders).toBe(false)
  })

  it('多くが25日線の上なら good', () => {
    const result = marketBreadth(market(18, 2))
    expect(result.level).toBe('good')
    expect(result.blocksNewOrders).toBe(false)
  })

  it(`${MIN_SAMPLE}銘柄未満では判定しない。少ない標本で止めると、ただの事故になる`, () => {
    const result = marketBreadth(market(0, MIN_SAMPLE - 1))
    expect(result.level).toBe('unknown')
    expect(result.blocksNewOrders).toBe(false)
  })

  it('株価データが足りない銘柄は数に入れない', () => {
    const base = market(6, 6)
    base.stocks.push(stock('THIN'))
    base.series.THIN = rising(10)
    expect(marketBreadth(base).total).toBe(12)
  })
})

describe('weeklyPlan / 地合い', () => {
  const settings = { ...DEFAULT_SETTINGS, capital: 5_000_000, riskPercent: 1 }
  // サンプルには「条件が揃っている」銘柄が入っている。そこに下げている銘柄を混ぜて
  // 地合いだけを悪くし、同じ候補が出なくなることを見る。
  const samples = buildSampleData()
  const sampleStocks = samples.map((sample) => sample.stock)
  const sampleSeries: Record<string, Bar[]> = Object.fromEntries(
    samples.map((sample) => [sample.stock.code, sample.bars]),
  )
  const now = new Date(`${samples[0].bars[samples[0].bars.length - 1].date}T18:00:00`)

  /** サンプルに、下げているだけの銘柄を足す。 */
  const withFillers = (count: number) => {
    const stocks = [...sampleStocks]
    const series: Record<string, Bar[]> = { ...sampleSeries }
    for (let i = 0; i < count; i += 1) {
      stocks.push(stock(`DOWN${i}`))
      series[`DOWN${i}`] = falling()
    }
    return { stocks, series }
  }

  it('前提：サンプルだけなら注文が1件出る', () => {
    const result = weeklyPlan({
      stocks: sampleStocks,
      series: sampleSeries,
      trades: [],
      settings,
      now,
    })
    expect(result.breadth.level).toBe('unknown')
    expect(result.orders).toHaveLength(1)
  })

  it('同じ候補でも、地合いが悪ければ注文を出さない', () => {
    const { stocks, series } = withFillers(15)
    const result = weeklyPlan({ stocks, series, trades: [], settings, now })

    expect(result.breadth.level).toBe('poor')
    expect(result.breadth.blocksNewOrders).toBe(true)
    expect(result.orders).toHaveLength(0)
  })

  it('止めた銘柄は、地合いを理由にして見送りに残す', () => {
    const { stocks, series } = withFillers(15)
    const result = weeklyPlan({ stocks, series, trades: [], settings, now })

    const blocked = result.skipped.filter((item) => item.reason.includes('25日線より上'))
    expect(blocked.length).toBeGreaterThan(0)
    expect(blocked[0].reason).toContain('新規を出しません')
  })

  it('建玉の損切りは、地合いでは動かさない', () => {
    const { stocks, series } = withFillers(15)
    const entryDate = samples[0].bars[samples[0].bars.length - 10].date
    const result = weeklyPlan({
      stocks,
      series,
      trades: [
        {
          id: 't1',
          code: samples[0].stock.code,
          name: samples[0].stock.name,
          side: 'long',
          entryDate,
          entryPrice: 3_000,
          shares: 100,
          stopPrice: 2_900,
          targetPrice: null,
          exitDate: null,
          exitPrice: null,
          fees: 0,
          reason: '',
          review: '',
          tags: [],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      settings,
      now,
    })

    expect(result.positions).toHaveLength(1)
    expect(result.positions[0].stopPrice).toBe(2_900)
  })
})
