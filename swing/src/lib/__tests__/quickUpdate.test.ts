import { describe, expect, it } from 'vitest'
import { parseQuoteLines } from '../market/quickUpdate'
import type { Stock } from '../market/types'

const stocks: Stock[] = [
  { code: '7203', name: 'トヨタ自動車', lot: 100, createdAt: 0 },
  { code: '9984', name: 'ソフトバンクグループ', lot: 100, createdAt: 0 },
  { code: '130A', name: '新規上場サンプル', lot: 100, createdAt: 0 },
]
const DATE = '2026-08-18'
const parse = (text: string) => parseQuoteLines(text, stocks, DATE)

describe('parseQuoteLines', () => {
  it('コードと終値だけの行を読む', () => {
    const [row] = parse('7203 2850')
    expect(row.code).toBe('7203')
    expect(row.name).toBe('トヨタ自動車')
    expect(row.bar).toMatchObject({ date: DATE, close: 2850, open: 2850 })
    expect(row.error).toBeNull()
  })

  it('4本値と出来高をまとめて読む', () => {
    const [row] = parse('7203,2840,2880,2830,2870,12500000')
    expect(row.bar).toEqual({
      date: DATE,
      open: 2840,
      high: 2880,
      low: 2830,
      close: 2870,
      volume: 12_500_000,
    })
  })

  it('桁区切りと銘柄名つきの1行をそのまま読む', () => {
    const [row] = parse('トヨタ自動車 7203 2,850 +1.2%')
    expect(row.code).toBe('7203')
    expect(row.bar?.close).toBe(2850)
  })

  it('前日比や変化率を価格と間違えない', () => {
    const [row] = parse('9984 9,300 +150 +1.64%')
    expect(row.bar?.close).toBe(9300)
  })

  it('タブ区切り(表からのコピー)も読む', () => {
    const rows = parse('7203\t2850\n9984\t9300')
    expect(rows.map((r) => r.bar?.close)).toEqual([2850, 9300])
  })

  it('全角の数字とカンマを直して読む', () => {
    const [row] = parse('７２０３　２，８５０')
    expect(row.code).toBe('7203')
    expect(row.bar?.close).toBe(2850)
  })

  it('4桁目が英字の新形式コードも扱う', () => {
    const [row] = parse('130A 1200')
    expect(row.code).toBe('130A')
  })

  it('コードが無くても登録済みの銘柄名で判別する', () => {
    const [row] = parse('ソフトバンクグループ 9,300')
    expect(row.code).toBe('9984')
    expect(row.bar?.close).toBe(9300)
  })

  it('読めない行は理由をつけて返す', () => {
    const rows = parse('合計\n7203')
    expect(rows[0].error).toBe('銘柄コードが見つかりません')
    expect(rows[1].error).toBe('価格が読み取れません')
  })

  it('空行は無視する', () => {
    expect(parse('\n\n7203 2850\n\n')).toHaveLength(1)
  })

  it('出来高らしくない小さな数値は価格として残す', () => {
    // 株価900円 + 出来高8000株のような並びでは、出来高と断定しない
    const [row] = parse('9984 900 8000')
    expect(row.bar?.close).toBe(900)
  })
})
