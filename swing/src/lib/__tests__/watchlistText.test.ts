import { describe, expect, it } from 'vitest'
import { buildWatchlistText } from '../export/watchlistText'
import { buildSampleData } from '../market/sampleData'
import { DEFAULT_SETTINGS } from '../db/schema'
import type { Trade } from '../money/trade'
import type { Bar } from '../market/types'

const samples = buildSampleData()
const stocks = samples.map((sample) => sample.stock)
const series: Record<string, Bar[]> = Object.fromEntries(
  samples.map((sample) => [sample.stock.code, sample.bars]),
)
const settings = { ...DEFAULT_SETTINGS, capital: 2_000_000, riskPercent: 1 }
const now = new Date('2026-08-22T12:30:00')

const trade: Trade = {
  id: 't1',
  code: 'SMPL1',
  name: 'サンプルA(押し目)',
  side: 'long',
  entryDate: '2026-08-18',
  entryPrice: 3_100,
  shares: 100,
  stopPrice: 2_950,
  targetPrice: 3_400,
  exitDate: null,
  exitPrice: null,
  fees: 0,
  reason: '',
  review: '',
  tags: [],
  createdAt: 0,
  updatedAt: 0,
}

describe('buildWatchlistText', () => {
  it('設定と日時を先頭に書く', () => {
    const text = buildWatchlistText({ stocks, series, trades: [], settings, now })
    expect(text).toContain('2026-08-22 12:30 時点')
    expect(text).toContain('資金 2,000,000円')
    expect(text).toContain('許容損失 20,000円(1%)')
  })

  it('スコア順に並べ、判定と指標を書く', () => {
    const text = buildWatchlistText({ stocks, series, trades: [], settings, now })
    expect(text).toContain('【監視 5銘柄】')
    // 押し目のサンプルが先頭に来る
    const first = text.split('\n').findIndex((line) => line.startsWith('SMPL1'))
    const last = text.split('\n').findIndex((line) => line.startsWith('SMPL3'))
    expect(first).toBeGreaterThan(0)
    expect(first).toBeLessThan(last)
    expect(text).toMatch(/スコア\d+ 条件が揃っている/)
    expect(text).toContain('乖離')
    expect(text).toContain('RSI')
    expect(text).toContain('財務')
  })

  it('良い材料と警戒材料を分けて書く', () => {
    const text = buildWatchlistText({ stocks, series, trades: [], settings, now })
    expect(text).toContain('○ 上昇トレンド')
    expect(text).toMatch(/× .*(下降トレンド|買われすぎ|離れすぎ|下向き)/)
  })

  it('建玉があれば含み損益と損切りを書く', () => {
    const text = buildWatchlistText({ stocks, series, trades: [trade], settings, now })
    expect(text).toContain('[建玉あり]')
    expect(text).toContain('【建玉 1件】')
    expect(text).toContain('8/18買 3,100円×100株')
    expect(text).toContain('損切2,950円')
  })

  it('手仕舞い済みがあれば成績を書く', () => {
    const closed: Trade = { ...trade, id: 't2', exitDate: '2026-08-20', exitPrice: 3_300 }
    const text = buildWatchlistText({ stocks, series, trades: [closed], settings, now })
    expect(text).toContain('【成績】1回 / 勝ち1 / 損益合計 +20,000円')
  })

  it('価格データが無い銘柄も落とさずに書く', () => {
    const text = buildWatchlistText({
      stocks: [{ code: '4828', name: 'B-EN-G', lot: 100, createdAt: 0 }],
      series: {},
      trades: [],
      settings,
      now,
    })
    expect(text).toContain('4828 B-EN-G')
    expect(text).toContain('価格データなし')
  })

  it('登録が無ければその旨を書く', () => {
    const text = buildWatchlistText({ stocks: [], series: {}, trades: [], settings, now })
    expect(text).toContain('【監視 0銘柄】')
    expect(text).toContain('(登録なし)')
  })
})
