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

describe('時系列ページの表をコピーして貼った場合', () => {
  it('タブ区切り・日本語ヘッダー・桁区切り・余分な列があっても読める', () => {
    const pasted = [
      '日付\t始値\t高値\t安値\t終値\t出来高\t終値調整値',
      '2026年8月18日\t1,234\t1,250\t1,230\t1,245\t123,400\t1,245',
      '2026年8月17日\t1,220\t1,240\t1,215\t1,232\t98,700\t1,232',
    ].join('\n')
    const result = parsePriceCsv(pasted)
    expect(result.error).toBeNull()
    expect(result.rows).toHaveLength(2)
    expect(result.rows[1]).toEqual({
      date: '2026-08-18',
      open: 1234,
      high: 1250,
      low: 1230,
      close: 1245,
      volume: 123400,
    })
  })

  it('前日比や騰落率の列が混ざっていても終値を取り違えない', () => {
    const pasted = [
      '日付,終値,前日比,前日比(%),始値,高値,安値,出来高',
      '2026/08/18,"1,245","+13","+1.06%","1,234","1,250","1,230","123,400"',
    ].join('\n')
    const result = parsePriceCsv(pasted)
    expect(result.rows[0]).toMatchObject({ close: 1245, open: 1234, volume: 123400 })
  })

  it('新しい日付が上にある表(降順)でも古い順に並べ直す', () => {
    const pasted = '日付\t終値\n2026/08/18\t1245\n2026/08/17\t1232\n2026/08/14\t1210'
    const result = parsePriceCsv(pasted)
    expect(result.rows.map((b) => b.date)).toEqual(['2026-08-14', '2026-08-17', '2026-08-18'])
  })
})

describe('Yahoo!ファイナンスの時系列ページをコピーした場合', () => {
  // 実際の列並び。PER/PBRは有料部分が鍵アイコンになり、コピーすると空欄になる。
  const pasted = [
    '日付\tPER\tPBR\t出来高\t始値\t高値\t安値\t終値',
    '26/8/18\t17.86\t4.92\t102,500\t1,360\t1,388\t1,345\t1,377',
    '26/8/17\t17.49\t4.82\t136,500\t1,364\t1,380\t1,348\t1,364',
    '26/8/5\t\t\t79,200\t1,181\t1,194\t1,177\t1,190',
  ].join('\n')

  it('西暦2桁の日付を2000年代として読む', () => {
    expect(parseDate('26/8/18')).toBe('2026-08-18')
    expect(parseDate('26/12/1')).toBe('2026-12-01')
    expect(parseDate('99/1/4')).toBe('1999-01-04')
  })

  it('PER/PBRの列や空欄が混ざっていても正しい列を読む', () => {
    const result = parsePriceCsv(pasted)
    expect(result.error).toBeNull()
    expect(result.rows).toHaveLength(3)
    expect(result.rows[2]).toEqual({
      date: '2026-08-18',
      open: 1360,
      high: 1388,
      low: 1345,
      close: 1377,
      volume: 102_500,
    })
  })

  it('有料部分が空欄の行も株価は取り込める', () => {
    const result = parsePriceCsv(pasted)
    expect(result.rows[0]).toMatchObject({ date: '2026-08-05', close: 1190, volume: 79_200 })
    expect(result.skipped).toBe(0)
  })
})

describe('スマホでコピーした「1セルずつ改行」の表', () => {
  // 見出しは1行、値は縦一列。有料のPER/PBRが鍵アイコンの行は値が欠ける。
  const pasted = [
    '日付\tPER\tPBR\t出来高\t始値\t高値\t安値\t終値\t調整後終値',
    '26/8/19',
    '18.41',
    '5.07',
    '69,400',
    '1,384',
    '1,423',
    '1,384',
    '1,411',
    '1,411',
    '26/8/18',
    '17.86',
    '4.92',
    '102,500',
    '1,360',
    '1,388',
    '1,345',
    '1,377',
    '1,377',
    // 鍵アイコンでPER/PBRがコピーされなかった日
    '26/8/5',
    '79,200',
    '1,181',
    '1,194',
    '1,177',
    '1,190',
    '1,190',
  ].join('\n')

  it('日付を区切りとして1日分ずつ読む', () => {
    const result = parsePriceCsv(pasted)
    expect(result.error).toBeNull()
    expect(result.rows).toHaveLength(3)
    expect(result.rows[2]).toEqual({
      date: '2026-08-19',
      open: 1384,
      high: 1423,
      low: 1384,
      close: 1411,
      volume: 69_400,
    })
  })

  it('有料項目が欠けた行も、株価の並びを右端で揃えて読む', () => {
    const result = parsePriceCsv(pasted)
    expect(result.rows[0]).toEqual({
      date: '2026-08-05',
      open: 1181,
      high: 1194,
      low: 1177,
      close: 1190,
      volume: 79_200,
    })
  })

  it('見出しも1語ずつ改行されている場合を読む', () => {
    const oneWordPerLine = ['日付', '出来高', '始値', '高値', '安値', '終値', '26/8/18', '102,500', '1,360', '1,388', '1,345', '1,377'].join('\n')
    const result = parsePriceCsv(oneWordPerLine)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({ date: '2026-08-18', close: 1377, volume: 102_500 })
  })
})

describe('見出しの無い、途中からの貼り付け', () => {
  it('日付・出来高・4本値の並びを見出し無しで読む', () => {
    // 実際に画面から途中だけコピーしたときの形
    const pasted = ['26/5/29', '97,200', '1,073', '1,085', '1,051', '1,073', '1,073'].join('\n')
    const result = parsePriceCsv(pasted)
    expect(result.error).toBeNull()
    expect(result.rows[0]).toEqual({
      date: '2026-05-29',
      open: 1073,
      high: 1085,
      low: 1051,
      close: 1073,
      volume: 97_200,
    })
  })

  it('PER・PBRが前に付いていても4本値を見つける', () => {
    const pasted = ['26/8/19', '18.41', '5.07', '69,400', '1,384', '1,423', '1,384', '1,411', '1,411'].join('\n')
    const result = parsePriceCsv(pasted)
    expect(result.rows[0]).toMatchObject({ open: 1384, high: 1423, low: 1384, close: 1411, volume: 69_400 })
  })

  it('前日比などが後ろに付く並び(株探の形)でも4本値を見つける', () => {
    // 日付, 始値, 高値, 安値, 終値, 前日比, 前日比(%), 売買高
    const pasted = ['26/8/19', '1,384', '1,423', '1,384', '1,411', '34', '2.47', '69,400'].join('\n')
    const result = parsePriceCsv(pasted)
    expect(result.rows[0]).toMatchObject({ open: 1384, high: 1423, low: 1384, close: 1411 })
  })

  it('日付と終値だけでも取り込める', () => {
    const result = parsePriceCsv(['26/8/19', '1,411', '26/8/18', '1,377'].join('\n'))
    expect(result.rows.map((b) => [b.date, b.close])).toEqual([
      ['2026-08-18', 1377],
      ['2026-08-19', 1411],
    ])
  })

  it('複数日をまとめて、欠けた行が混ざっていても読む', () => {
    const pasted = [
      '26/8/19', '18.41', '5.07', '69,400', '1,384', '1,423', '1,384', '1,411', '1,411',
      '26/8/18', '102,500', '1,360', '1,388', '1,345', '1,377', '1,377',
      '26/8/17', '1,364',
    ].join('\n')
    const result = parsePriceCsv(pasted)
    expect(result.rows).toHaveLength(3)
    expect(result.rows.map((b) => b.close)).toEqual([1364, 1377, 1411])
  })

  it('価格として解釈できない並びは取り込まずに数える', () => {
    const result = parsePriceCsv(['26/8/19', '4,828', '2,000,000', '0.5'].join('\n'))
    expect(result.rows).toHaveLength(0)
    expect(result.error).not.toBeNull()
  })
})
