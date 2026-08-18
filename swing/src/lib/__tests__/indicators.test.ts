import { describe, expect, it } from 'vitest'
import {
  atr,
  bollinger,
  crossedAbove,
  ema,
  highest,
  lowest,
  macd,
  rsi,
  sma,
  trueRange,
} from '../market/indicators'
import type { Bar } from '../market/types'

const bar = (close: number, high = close + 1, low = close - 1, open = close): Bar => ({
  date: '2026-01-01',
  open,
  high,
  low,
  close,
  volume: 1000,
})

describe('sma', () => {
  it('確定するまではnull、以降は単純平均を返す', () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4])
  })

  it('期間が足りなければすべてnull', () => {
    expect(sma([1, 2], 5)).toEqual([null, null])
  })
})

describe('ema', () => {
  it('最初の値は単純平均、以降は平滑化した値になる', () => {
    const result = ema([1, 2, 3, 4, 5], 3)
    expect(result[2]).toBe(2)
    // k = 0.5 なので 4*0.5 + 2*0.5 = 3
    expect(result[3]).toBe(3)
    expect(result[4]).toBe(4)
  })
})

describe('rsi', () => {
  it('上げ続けたら100に近づく', () => {
    const values = Array.from({ length: 40 }, (_, i) => 100 + i)
    expect(rsi(values, 14)?.at(-1)).toBe(100)
  })

  it('下げ続けたら0に近づく', () => {
    const values = Array.from({ length: 40 }, (_, i) => 100 - i)
    expect(rsi(values, 14)?.at(-1)).toBe(0)
  })

  it('横ばいなら50付近', () => {
    const values = Array.from({ length: 40 }, (_, i) => (i % 2 === 0 ? 100 : 101))
    const value = rsi(values, 14).at(-1)
    expect(value).toBeGreaterThan(40)
    expect(value).toBeLessThan(60)
  })
})

describe('macd', () => {
  it('上昇局面ではMACDがシグナルを上回る', () => {
    const values = Array.from({ length: 80 }, (_, i) => 100 * 1.01 ** i)
    const result = macd(values)
    const last = result.macd.at(-1)
    const signal = result.signal.at(-1)
    expect(last).not.toBeNull()
    expect(signal).not.toBeNull()
    expect(last!).toBeGreaterThan(signal!)
    expect(result.histogram.at(-1)!).toBeCloseTo(last! - signal!, 6)
  })
})

describe('bollinger', () => {
  it('同じ値が続けば標準偏差0でバンドが重なる', () => {
    const values = new Array(25).fill(100)
    const result = bollinger(values, 20, 2)
    expect(result.middle.at(-1)).toBe(100)
    expect(result.upper.at(-1)).toBe(100)
    expect(result.lower.at(-1)).toBe(100)
  })
})

describe('trueRange / atr', () => {
  it('前日終値を挟んだ動きも値幅に含める', () => {
    const bars = [bar(100), { ...bar(110), low: 105, high: 112 }]
    expect(trueRange(bars)[1]).toBe(12) // 112 - 100
  })

  it('期間が足りるとATRが求まる', () => {
    const bars = Array.from({ length: 20 }, () => bar(100, 102, 98))
    expect(atr(bars, 14).at(-1)).toBeCloseTo(4, 6)
  })
})

describe('highest / lowest', () => {
  it('直近n本の高値と安値を返す', () => {
    const bars = [bar(100), bar(120), bar(90)]
    expect(highest(bars, 2).at(-1)).toBe(121)
    expect(lowest(bars, 2).at(-1)).toBe(89)
  })
})

describe('crossedAbove', () => {
  it('当日抜けたら0を返す', () => {
    expect(crossedAbove([1, 2, 3, 4], [3, 3, 3, 3], 3, 3)).toBe(0)
  })

  it('数日前に抜けていればその本数を返す', () => {
    expect(crossedAbove([1, 2, 4, 5], [3, 3, 3, 3], 3, 3)).toBe(1)
  })

  it('抜けていなければnull', () => {
    expect(crossedAbove([1, 1, 1], [3, 3, 3], 2, 3)).toBeNull()
  })
})
