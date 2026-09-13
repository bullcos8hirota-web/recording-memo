import { describe, expect, it } from 'vitest'
import { screenMarket, shortCode } from '../plan/screener'
import { DEFAULT_SETTINGS } from '../db/schema'
import type { MarketRow } from '../market/jquants'

// 資金197万・リスク1%・上限30%・ATR2倍 → 株価1,000〜3,940円 / 売買代金1億円以上
const settings = { ...DEFAULT_SETTINGS, capital: 1_970_000, riskPercent: 1 }

const row = (patch: Partial<MarketRow> & { code: string }): MarketRow => ({
  close: 2_000,
  high: 2_060,
  low: 1_990,
  turnover: 500_000_000,
  ...patch,
})

describe('screenMarket', () => {
  it('この資金で単元を買える株価だけ残す', () => {
    const rows = [
      row({ code: '1111', close: 2_000, high: 2_060, low: 1_990 }),
      row({ code: '2222', close: 8_000, high: 8_300, low: 7_900 }), // 高すぎる
      row({ code: '3333', close: 400, high: 420, low: 395 }), // 安すぎる
    ]
    const codes = screenMarket(rows, { settings }).candidates.map((c) => c.code)
    expect(codes).toEqual(['1111'])
  })

  it('商いが薄い銘柄は落とす', () => {
    const rows = [
      row({ code: '1111' }),
      row({ code: '2222', turnover: 20_000_000 }),
    ]
    expect(screenMarket(rows, { settings }).candidates.map((c) => c.code)).toEqual(['1111'])
  })

  it('動かない銘柄は落とす', () => {
    const rows = [
      row({ code: '1111', close: 2_000, high: 2_060, low: 1_990 }), // 3.5%
      row({ code: '2222', close: 2_000, high: 2_010, low: 1_995 }), // 0.75%
    ]
    expect(screenMarket(rows, { settings }).candidates.map((c) => c.code)).toEqual(['1111'])
  })

  it('登録済みの銘柄は出さない(5桁でも4桁でも)', () => {
    const rows = [row({ code: '72030' }), row({ code: '1111' })]
    const codes = screenMarket(rows, { settings, exclude: ['7203'] }).candidates.map((c) => c.code)
    expect(codes).toEqual(['1111'])
  })

  it('売買代金の大きい順に、上限まで返す', () => {
    const rows = [
      row({ code: '1111', turnover: 100_000_000 }),
      row({ code: '2222', turnover: 900_000_000 }),
      row({ code: '3333', turnover: 500_000_000 }),
    ]
    const result = screenMarket(rows, { settings, limit: 2 })
    expect(result.candidates.map((c) => c.code)).toEqual(['2222', '3333'])
  })

  it('どの段で落ちたかを数える', () => {
    const rows = [
      row({ code: '1111' }),
      row({ code: '2222', close: 8_000, high: 8_300, low: 7_900 }),
      row({ code: '3333', turnover: 1_000_000 }),
      row({ code: '4444', high: 2_005, low: 1_995 }),
    ]
    expect(screenMarket(rows, { settings }).counts).toEqual({
      all: 4,
      priced: 3,
      liquid: 2,
      moving: 1,
    })
  })
})

describe('shortCode', () => {
  it('5桁で末尾0なら4桁にする', () => {
    expect(shortCode('72030')).toBe('7203')
  })

  it('4桁はそのまま', () => {
    expect(shortCode('7203')).toBe('7203')
  })

  it('英字を含むコードは触らない', () => {
    expect(shortCode('215A0')).toBe('215A')
    expect(shortCode('215A')).toBe('215A')
  })
})
