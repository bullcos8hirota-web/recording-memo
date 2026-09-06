import { describe, expect, it } from 'vitest'
import {
  BackupError,
  backupFileName,
  buildBackup,
  describeBackup,
  parseBackup,
} from '../db/backup'
import { DEFAULT_SETTINGS } from '../db/schema'
import type { Trade } from '../money/trade'

const settings = { ...DEFAULT_SETTINGS, capital: 2_000_000, jquantsApiKey: 'SECRET' }
const stocks = [{ code: '7203', name: 'トヨタ', lot: 100, memo: '', createdAt: 1 }]
const series = [
  {
    code: '7203',
    bars: [{ date: '2026-09-04', open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }],
    updatedAt: 1,
  },
]
const trades: Trade[] = [
  {
    id: 't1',
    code: '7203',
    name: 'トヨタ',
    side: 'long',
    entryDate: '2026-08-28',
    entryPrice: 3148,
    shares: 100,
    stopPrice: 3079,
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
]
const now = new Date('2026-09-06T10:00:00Z')

describe('buildBackup', () => {
  it('既定ではAPIキーを持ち出さない', () => {
    const backup = buildBackup({ settings, stocks, series, trades, now })
    expect(backup.settings.jquantsApiKey).toBeUndefined()
    expect(JSON.stringify(backup)).not.toContain('SECRET')
  })

  it('明示したときだけAPIキーを入れる', () => {
    const backup = buildBackup({ settings, stocks, series, trades, includeApiKey: true, now })
    expect(backup.settings.jquantsApiKey).toBe('SECRET')
  })

  it('中身をそのまま持つ', () => {
    const backup = buildBackup({ settings, stocks, series, trades, now })
    expect(backup.stocks).toHaveLength(1)
    expect(backup.series[0].bars).toHaveLength(1)
    expect(backup.trades[0].id).toBe('t1')
    expect(backup.exportedAt).toContain('2026-09-06')
  })
})

describe('parseBackup', () => {
  const text = JSON.stringify(buildBackup({ settings, stocks, series, trades, now }))

  it('書き出したものをそのまま読み戻せる', () => {
    const backup = parseBackup(text)
    expect(backup.stocks[0].code).toBe('7203')
    expect(backup.trades[0].entryPrice).toBe(3148)
    expect(backup.settings.capital).toBe(2_000_000)
  })

  it('JSONでなければ断る', () => {
    expect(() => parseBackup('これはファイルではありません')).toThrow(BackupError)
  })

  it('別のアプリのJSONは断る', () => {
    expect(() => parseBackup('{"format":"other","version":1}')).toThrow(BackupError)
  })

  it('新しい版のファイルは断る', () => {
    const future = JSON.stringify({ ...JSON.parse(text), version: 99 })
    expect(() => parseBackup(future)).toThrow(/新しい版/)
  })

  it('中身が壊れていれば読み込まない', () => {
    const broken = JSON.stringify({ ...JSON.parse(text), stocks: [{ name: '名前だけ' }] })
    expect(() => parseBackup(broken)).toThrow(/銘柄の形/)
  })

  it('古いファイルに無い設定は既定値で埋める', () => {
    const old = JSON.stringify({
      format: 'swing-trade-backup',
      version: 1,
      exportedAt: '2026-01-01T00:00:00Z',
      settings: { id: 'app', capital: 500_000 },
      stocks: [],
      series: [],
      trades: [],
    })
    const backup = parseBackup(old)
    expect(backup.settings.capital).toBe(500_000)
    expect(backup.settings.atrMultiple).toBe(DEFAULT_SETTINGS.atrMultiple)
  })
})

describe('見せ方', () => {
  it('ファイル名に日付を入れる', () => {
    expect(backupFileName(now)).toBe('swing-trade-2026-09-06.json')
  })

  it('読み込む前に中身を要約する', () => {
    const backup = buildBackup({ settings, stocks, series, trades, now })
    expect(describeBackup(backup)).toBe(
      '2026-09-06に書き出したもの: 銘柄1件 / 株価1本 / 売買記録1件',
    )
  })

  it('APIキーが入っていればそれも伝える', () => {
    const backup = buildBackup({ settings, stocks, series, trades, includeApiKey: true, now })
    expect(describeBackup(backup)).toContain('APIキーあり')
  })
})
