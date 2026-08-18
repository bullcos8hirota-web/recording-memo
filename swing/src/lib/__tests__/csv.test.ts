import { describe, expect, it } from 'vitest'
import {
  matchExecutions,
  parseCsv,
  parseDate,
  parseNumber,
  parsePriceCsv,
  parseTradeHistoryCsv,
} from '../market/csv'

describe('parseCsv', () => {
  it('引用符付きのカンマや改行を壊さない', () => {
    const rows = parseCsv('a,"b,c",d\r\n1,"2""3",4\n')
    expect(rows).toEqual([
      ['a', 'b,c', 'd'],
      ['1', '2"3', '4'],
    ])
  })

  it('BOMと空行を落とす', () => {
    expect(parseCsv('﻿a,b\n\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
})

describe('parseNumber', () => {
  it('桁区切りや単位を外す', () => {
    expect(parseNumber('1,234')).toBe(1234)
    expect(parseNumber('1,234.5円')).toBe(1234.5)
    expect(parseNumber('▲500')).toBe(-500)
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('--')).toBeNull()
  })
})

describe('parseDate', () => {
  it('日本の証券会社でよくある表記を受け付ける', () => {
    expect(parseDate('2026/8/18')).toBe('2026-08-18')
    expect(parseDate('2026-08-18')).toBe('2026-08-18')
    expect(parseDate('20260818')).toBe('2026-08-18')
    expect(parseDate('2026年8月18日')).toBe('2026-08-18')
    expect(parseDate('不明')).toBeNull()
  })
})

describe('parsePriceCsv', () => {
  it('日本語ヘッダーの日足CSVを読む', () => {
    const csv = [
      '日付,始値,高値,安値,終値,出来高',
      '2026/08/17,"1,800","1,830","1,795","1,825","1,200,000"',
      '2026/08/18,1825,1860,1820,1855,1500000',
    ].join('\n')
    const result = parsePriceCsv(csv)
    expect(result.error).toBeNull()
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toEqual({
      date: '2026-08-17',
      open: 1800,
      high: 1830,
      low: 1795,
      close: 1825,
      volume: 1_200_000,
    })
  })

  it('ヘッダーが無ければ並び順で解釈する', () => {
    const result = parsePriceCsv('2026-08-18,100,110,95,105,1000')
    expect(result.rows[0].close).toBe(105)
  })

  it('日付順に並べ替え、同じ日付は後の行で上書きする', () => {
    const csv = [
      '日付,終値',
      '2026-08-18,110',
      '2026-08-17,100',
      '2026-08-18,120',
    ].join('\n')
    const result = parsePriceCsv(csv)
    expect(result.rows.map((b) => b.date)).toEqual(['2026-08-17', '2026-08-18'])
    expect(result.rows[1].close).toBe(120)
  })

  it('読めない行は数えて飛ばす', () => {
    const result = parsePriceCsv('日付,終値\n2026-08-18,100\n合計,-\n')
    expect(result.rows).toHaveLength(1)
    expect(result.skipped).toBe(1)
  })

  it('終値の列が無ければエラーを返す', () => {
    expect(parsePriceCsv('名前,値\nA,1').error).not.toBeNull()
  })
})

const HISTORY = [
  '約定日,銘柄コード,銘柄名,取引,約定数量,約定単価,手数料/諸経費等',
  '2026/06/02,7203,サンプル商事,株式現物買,200,1000,0',
  '2026/06/10,7203,サンプル商事,株式現物売,100,1100,0',
  '2026/06/20,7203,サンプル商事,株式現物売,100,1200,0',
  '2026/07/01,9984,サンプル電機,株式現物買,100,500,0',
].join('\n')

describe('parseTradeHistoryCsv', () => {
  it('列名から必要な項目を拾う', () => {
    const result = parseTradeHistoryCsv(HISTORY)
    expect(result.error).toBeNull()
    expect(result.rows).toHaveLength(4)
    expect(result.rows[0]).toMatchObject({ code: '7203', side: 'buy', shares: 200, price: 1000 })
    expect(result.rows[1].side).toBe('sell')
  })

  it('形式が違えばエラーを返す', () => {
    expect(parseTradeHistoryCsv('見出し\n値').error).not.toBeNull()
  })
})

describe('matchExecutions', () => {
  it('買いと売りを古い順に突き合わせ、分割売却も分けて記録する', () => {
    const trades = matchExecutions(parseTradeHistoryCsv(HISTORY).rows)
    expect(trades).toHaveLength(3)
    expect(trades[0]).toMatchObject({
      code: '7203',
      entryPrice: 1000,
      shares: 100,
      exitPrice: 1100,
    })
    expect(trades[1]).toMatchObject({ shares: 100, exitPrice: 1200 })
    expect(trades[2]).toMatchObject({ code: '9984', exitDate: null })
  })

  it('手数料は株数で按分する', () => {
    const csv = [
      '約定日,銘柄コード,銘柄名,取引,約定数量,約定単価,手数料/諸経費等',
      '2026/06/02,7203,サンプル,株式現物買,200,1000,200',
      '2026/06/10,7203,サンプル,株式現物売,100,1100,100',
    ].join('\n')
    const trades = matchExecutions(parseTradeHistoryCsv(csv).rows)
    expect(trades[0].fees).toBe(200) // 買い100株分の100円 + 売り100円
  })
})
