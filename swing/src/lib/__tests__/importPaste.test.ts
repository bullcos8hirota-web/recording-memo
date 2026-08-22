import { describe, expect, it } from 'vitest'
import { analyzePaste } from '../market/importPaste'
import type { Stock } from '../market/types'

const stocks: Stock[] = [
  { code: '4828', name: 'B-EN-G', lot: 100, createdAt: 0 },
  { code: '9768', name: 'いであ', lot: 100, createdAt: 0 },
]
const DATE = '2026-08-22'
const run = (text: string) => analyzePaste(text, stocks, DATE)

describe('analyzePaste', () => {
  it('日付入りの表は時系列として読む', () => {
    const result = run(['26/8/21', '97,200', '1,410', '1,430', '1,405', '1,425'].join('\n'))
    expect(result.kind).toBe('series')
    if (result.kind !== 'series') return
    expect(result.bars).toHaveLength(1)
    expect(result.bars[0]).toMatchObject({ date: '2026-08-21', close: 1425 })
  })

  it('見出し付きのCSVも時系列として読む', () => {
    const result = run('日付,始値,高値,安値,終値\n2026/08/21,1410,1430,1405,1425')
    expect(result.kind).toBe('series')
  })

  it('日付が無くコードがあれば、その日の値として読む', () => {
    const result = run('4828 1425\n9768 3740')
    expect(result.kind).toBe('quotes')
    if (result.kind !== 'quotes') return
    expect(result.rows.map((row) => [row.code, row.bar?.close])).toEqual([
      ['4828', 1425],
      ['9768', 3740],
    ])
    expect(result.rows[0].bar?.date).toBe(DATE)
  })

  it('銘柄名と桁区切りが混ざっていても、その日の値として読む', () => {
    const result = run('いであ 9768 3,740 +0.3%')
    expect(result.kind).toBe('quotes')
    if (result.kind !== 'quotes') return
    expect(result.rows[0]).toMatchObject({ code: '9768', name: 'いであ' })
  })

  it('空なら理由を出さない', () => {
    const result = run('   ')
    expect(result).toEqual({ kind: 'empty', reason: null })
  })

  it('読めない文字列は理由を返す', () => {
    const result = run('本日の相場について')
    expect(result.kind).toBe('empty')
    if (result.kind !== 'empty') return
    expect(result.reason).toContain('読み取れませんでした')
  })
})
