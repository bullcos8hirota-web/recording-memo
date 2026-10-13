import { describe, expect, it } from 'vitest'
import { backtest, entryFill, stopFill, WARMUP_BARS } from '../backtest/simulate'
import { buildSampleData } from '../market/sampleData'
import { DEFAULT_SETTINGS } from '../db/schema'
import type { Bar } from '../market/types'

const bar = (patch: Partial<Bar>): Bar => ({
  date: '2026-01-05',
  open: 1_000,
  high: 1_010,
  low: 990,
  close: 1_005,
  volume: 100_000,
  ...patch,
})

describe('entryFill / 逆指値の買い', () => {
  it('高値がトリガーに届かなければ約定しない', () => {
    expect(entryFill(bar({ high: 1_010 }), 1_020)).toBeNull()
  })

  it('日中に届いたらトリガー価格で買う', () => {
    expect(entryFill(bar({ open: 1_000, high: 1_030 }), 1_020)).toBe(1_020)
  })

  it('上に窓を開けて始まったら、寄値で買う。トリガー価格では買えない', () => {
    expect(entryFill(bar({ open: 1_050, high: 1_060 }), 1_020)).toBe(1_050)
  })
})

describe('stopFill / 損切り', () => {
  it('安値が損切りまで下がらなければ切らない', () => {
    expect(stopFill(bar({ low: 990 }), 980)).toBeNull()
  })

  it('日中に割ったら損切り価格で売る', () => {
    expect(stopFill(bar({ open: 1_000, low: 970 }), 980)).toBe(980)
  })

  it('下に窓を開けて始まったら、寄値で売る。損切り価格では売れない', () => {
    // トヨタで実際に起きた形。損切り3,079円に対し、その日の高値が3,040円だった。
    expect(stopFill(bar({ open: 3_025, high: 3_040, low: 3_000 }), 3_079)).toBe(3_025)
  })

  it('窓を無視すると負けが小さく出る。そうなっていないこと', () => {
    const gapped = stopFill(bar({ open: 900, high: 920, low: 880 }), 980)!
    expect(gapped).toBeLessThan(980)
  })
})

describe('backtest', () => {
  const samples = buildSampleData()
  const series: Record<string, Bar[]> = Object.fromEntries(
    samples.map((sample) => [sample.stock.code, sample.bars]),
  )
  const stocks = samples.map((sample) => sample.stock)
  const settings = { ...DEFAULT_SETTINGS, capital: 2_000_000, riskPercent: 1 }
  const result = backtest({ stocks, series, settings })!

  const barOf = (code: string, date: string) =>
    series[code].find((item) => item.date === date)

  it('日足が足りなければ null を返す', () => {
    const short = Object.fromEntries(
      Object.entries(series).map(([code, bars]) => [code, bars.slice(0, WARMUP_BARS)]),
    )
    expect(backtest({ stocks, series: short, settings })).toBeNull()
  })

  it('助走ぶんを飛ばしてから始める', () => {
    const dates = [...new Set(Object.values(series).flat().map((item) => item.date))].sort()
    expect(result.from).toBe(dates[WARMUP_BARS])
  })

  it('毎週の判断を数えていて、トレードはその回数を超えない', () => {
    expect(result.decisions).toBeGreaterThan(0)
    expect(result.trades.length).toBeLessThanOrEqual(result.decisions)
  })

  it('買値は必ずその日の値幅の中にある', () => {
    for (const trade of result.trades) {
      const day = barOf(trade.code, trade.entryDate)!
      expect(trade.entryPrice).toBeGreaterThanOrEqual(day.open)
      expect(trade.entryPrice).toBeLessThanOrEqual(day.high)
    }
  })

  it('損切りの売値は、損切り価格より上にならない', () => {
    for (const trade of result.trades) {
      if (trade.reason === 'end') continue
      expect(trade.exitPrice).toBeLessThanOrEqual(trade.stopAtExit)
      expect(trade.exitPrice).toBeGreaterThanOrEqual(barOf(trade.code, trade.exitDate)!.low)
    }
  })

  it('買う前に売らない', () => {
    for (const trade of result.trades) {
      expect(trade.exitDate >= trade.entryDate).toBe(true)
    }
  })

  it('同時に持つ建玉は1つ。期間が重なっていない', () => {
    const sorted = [...result.trades].sort((a, b) => a.entryDate.localeCompare(b.entryDate))
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i].entryDate >= sorted[i - 1].exitDate).toBe(true)
    }
  })

  it('損益は、売値と買値と手数料から再計算しても一致する', () => {
    for (const trade of result.trades) {
      const expected = (trade.exitPrice - trade.entryPrice) * trade.shares - trade.fees
      expect(trade.profit).toBeCloseTo(expected, 6)
    }
  })

  it('合計損益は、1件ずつの合計と一致する', () => {
    const sum = result.trades.reduce((total, trade) => total + trade.profit, 0)
    expect(result.totalProfit).toBeCloseTo(sum, 6)
  })

  it('勝ち負けの数が全体と合う', () => {
    expect(result.wins + result.losses).toBe(result.trades.length)
  })

  it('最大の落ち込みは0以上', () => {
    expect(result.maxDrawdown).toBeGreaterThanOrEqual(0)
    expect(result.maxDrawdownPercent).toBeGreaterThanOrEqual(0)
  })

  it('比較用の買い持ちは、同じ期間の全銘柄を使う', () => {
    expect(result.benchmark.stocks).toBe(stocks.length)
    expect(result.benchmark.equity[0].date).toBe(result.from)
  })

  it('未来を見ていない。途中で打ち切っても、それ以前の結果は変わらない', () => {
    // 後ろ半分を捨てて走らせたとき、前半に出たトレードは同じでなければならない。
    const dates = [...new Set(Object.values(series).flat().map((item) => item.date))].sort()
    const cutoff = dates[Math.floor(dates.length * 0.75)]
    const truncated = Object.fromEntries(
      Object.entries(series).map(([code, bars]) => [
        code,
        bars.filter((item) => item.date <= cutoff),
      ]),
    )
    const partial = backtest({ stocks, series: truncated, settings })!

    // 買う判断は、買った日までの情報だけで決まる。あとに何が起きるかを知っていても
    // 変わってはいけない。買値・株数・損切りは、打ち切っても同じでなければおかしい。
    expect(partial.from).toBe(result.from)
    expect(partial.trades.length).toBeGreaterThan(0)

    for (const [i, trade] of partial.trades.entries()) {
      if (trade.entryDate > cutoff) continue
      const full = result.trades[i]
      expect(full).toBeDefined()
      expect({
        code: trade.code,
        entryDate: trade.entryDate,
        entryPrice: trade.entryPrice,
        shares: trade.shares,
        stopAtEntry: trade.stopAtEntry,
      }).toEqual({
        code: full.code,
        entryDate: full.entryDate,
        entryPrice: full.entryPrice,
        shares: full.shares,
        stopAtEntry: full.stopAtEntry,
      })
    }

    // 打ち切り前に手仕舞いまで終わっているものは、丸ごと一致する。
    for (const trade of partial.trades.filter((t) => t.reason !== 'end')) {
      expect(result.trades).toContainEqual(trade)
    }
  })
})
