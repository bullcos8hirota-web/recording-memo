import { describe, expect, it } from 'vitest'
import { parseFundamentalsText } from '../learn/parseFundamentals'

describe('parseFundamentalsText', () => {
  it('縦に並んだ企業情報から比率を拾う', () => {
    const text = [
      '参考指標',
      'PER(会社予想)',
      '13.45倍',
      'PBR(実績)',
      '1.28倍',
      'ROE(実績)',
      '9.82%',
      '自己資本比率',
      '55.2%',
    ].join('\n')
    expect(parseFundamentalsText(text).ratios).toEqual({
      per: 13.45,
      pbr: 1.28,
      roe: 9.82,
      equityRatio: 55.2,
    })
  })

  it('1行に見出しと数字が並んでいても拾う', () => {
    const text = 'ROE 15.3%\t営業利益率 12.1%\tPER 18.2倍'
    expect(parseFundamentalsText(text).ratios).toMatchObject({
      roe: 15.3,
      operatingMargin: 12.1,
      per: 18.2,
    })
  })

  it('金額は単位を百万円に揃える', () => {
    const text = ['売上高', '4兆5,095億円', '営業利益', '5,400億円', '総資産', '93,000百万円'].join('\n')
    expect(parseFundamentalsText(text).statements).toEqual({
      revenue: 4_509_500, // 4兆5,095億円
      operatingProfit: 540_000,
      assets: 93_000,
    })
  })

  it('単位の無い金額は使わない（桁を取り違えるため）', () => {
    expect(parseFundamentalsText('売上高\n45000').statements).toEqual({})
  })

  it('「営業利益率」を「営業利益」として拾わない', () => {
    const found = parseFundamentalsText('営業利益率\n12.5%').statements
    expect(found.operatingProfit).toBeUndefined()
  })

  it('読めるものが無ければ空で返す', () => {
    expect(parseFundamentalsText('本日の相場について')).toEqual({ ratios: {}, statements: {} })
  })
})
