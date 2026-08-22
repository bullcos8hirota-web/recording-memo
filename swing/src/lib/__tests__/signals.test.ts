import { describe, expect, it } from 'vitest'
import { analyze, buildSnapshot } from '../market/signals'
import { buildSampleData } from '../market/sampleData'
import { mergeBars } from '../../stores/appStore'
import type { Bar } from '../market/types'

/** 終値の配列から日足を組み立てる。値幅は終値の±1%とする。 */
function series(closes: number[]): Bar[] {
  return closes.map((close, i) => ({
    date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`.replace(
      '2026-01',
      `2026-${String(Math.floor(i / 28) + 1).padStart(2, '0')}`,
    ),
    open: close * 0.999,
    high: close * 1.01,
    low: close * 0.99,
    close,
    volume: 1_000_000,
  }))
}

describe('buildSnapshot', () => {
  it('20日高値は前日までで計算する(当日の高値で自分を抜けない)', () => {
    const bars = series([...new Array(30).fill(100), 130])
    const snapshot = buildSnapshot(bars)
    expect(snapshot.high20).toBeCloseTo(101, 6)
    expect(snapshot.close).toBe(130)
  })

  it('乖離率と出来高倍率を出す', () => {
    const bars = series(new Array(40).fill(100))
    const snapshot = buildSnapshot(bars)
    expect(snapshot.deviation25).toBeCloseTo(0, 6)
    expect(snapshot.volumeRatio).toBeCloseTo(1, 6)
  })
})

describe('analyze', () => {
  it('上昇が続く形は上昇トレンドとして拾う', () => {
    const bars = series(Array.from({ length: 120 }, (_, i) => 1000 * 1.004 ** i))
    const analysis = analyze(bars)
    expect(analysis.trend).toBe('up')
    expect(analysis.signals.map((s) => s.id)).toContain('trend-up')
    expect(analysis.score).toBeGreaterThan(50)
  })

  it('下げ続ける形は買い向きではないと判定する', () => {
    const bars = series(Array.from({ length: 120 }, (_, i) => 3000 * 0.996 ** i))
    const analysis = analyze(bars)
    expect(analysis.trend).toBe('down')
    expect(analysis.verdict).toBe('avoid')
    expect(analysis.score).toBeLessThan(50)
  })

  it('もみ合いから急に上抜けた日はブレイクアウトとして拾う', () => {
    const flat = Array.from({ length: 119 }, (_, i) => 1000 + (i % 2))
    const bars = series([...flat, 1100])
    bars[bars.length - 1].volume = 3_000_000
    const analysis = analyze(bars)
    const breakout = analysis.signals.find((s) => s.id === 'breakout')
    expect(breakout).toBeDefined()
    expect(breakout?.detail).toContain('出来高')
  })

  it('データが少ないと判定を保留する', () => {
    const analysis = analyze(series(new Array(40).fill(100)))
    expect(analysis.enoughBars).toBe(false)
    expect(analysis.verdict).toBe('neutral')
  })

  it('スコアは0〜100に収まる', () => {
    for (const { bars } of buildSampleData(200)) {
      const analysis = analyze(bars)
      expect(analysis.score).toBeGreaterThanOrEqual(0)
      expect(analysis.score).toBeLessThanOrEqual(100)
    }
  })
})

describe('サンプルデータ', () => {
  it('名前どおりの形になっている', () => {
    const byCode = Object.fromEntries(
      buildSampleData().map((s) => [s.stock.code, analyze(s.bars)]),
    )
    // A: 上昇トレンド中の押し目
    expect(byCode.SMPL1.trend).toBe('up')
    expect(byCode.SMPL1.signals.map((s) => s.id)).toContain('pullback')
    // B: もみ合いからのブレイク
    expect(byCode.SMPL2.signals.map((s) => s.id)).toContain('breakout')
    // C: 下降トレンドで手を出しにくい
    expect(byCode.SMPL3.trend).toBe('down')
    expect(byCode.SMPL3.verdict).toBe('avoid')
    // D: 方向感のないレンジ
    expect(byCode.SMPL4.trend).toBe('range')
    // E: 25日線から離れすぎた過熱
    expect(byCode.SMPL5.signals.map((s) => s.id)).toContain('overheat')
  })

  it('日付は重複せず昇順に並ぶ', () => {
    const bars = buildSampleData(60)[0].bars
    const dates = bars.map((b) => b.date)
    expect(new Set(dates).size).toBe(dates.length)
    expect([...dates].sort()).toEqual(dates)
  })
})

describe('mergeBars', () => {
  it('同じ日付は新しい方で置き換え、日付順に並べ直す', () => {
    const current = series([100, 110])
    const incoming = [{ ...current[1], close: 999 }, { ...current[0], date: '2026-01-05', close: 105 }]
    const merged = mergeBars(current, incoming)
    expect(merged.map((b) => b.date)).toEqual(['2026-01-01', '2026-01-02', '2026-01-05'])
    expect(merged[1].close).toBe(999)
  })

  it('終値だけを貼り直しても、前に入れた出来高と4本値は消さない', () => {
    const current = [
      { date: '2026-08-21', open: 3730, high: 3750, low: 3660, close: 3740, volume: 11_400 },
    ]
    const closeOnly = [
      { date: '2026-08-21', open: 3745, high: 3745, low: 3745, close: 3745, volume: 0 },
    ]
    const merged = mergeBars(current, closeOnly)
    expect(merged[0].close).toBe(3745)
    expect(merged[0].volume).toBe(11_400)
    expect(merged[0].high).toBe(3750)
    expect(merged[0].low).toBe(3660)
  })

  it('4本値と出来高が揃った貼り直しは、そのまま上書きする', () => {
    const current = [
      { date: '2026-08-21', open: 3730, high: 3750, low: 3660, close: 3740, volume: 0 },
    ]
    const full = [
      { date: '2026-08-21', open: 3735, high: 3760, low: 3665, close: 3750, volume: 11_400 },
    ]
    expect(mergeBars(current, full)[0]).toEqual(full[0])
  })
})

describe('出来高が入っていない日の扱い', () => {
  /** 終値だけを入れた日(出来高0)を最後に足した状態を作る。 */
  const withoutVolumeToday = (): Bar[] => {
    const bars = series(Array.from({ length: 120 }, (_, i) => 1000 * 1.002 ** i))
    return bars.map((bar, i) =>
      i === bars.length - 1 ? { ...bar, volume: 0 } : { ...bar, volume: 1_000_000 },
    )
  }

  it('出来高0は「薄商い」ではなく不明として扱う', () => {
    const analysis = analyze(withoutVolumeToday())
    expect(analysis.snapshot.volumeRatio).toBeNull()
    expect(analysis.signals.map((s) => s.id)).not.toContain('low-volume')
  })

  it('本当に出来高が細い日は減点する', () => {
    const bars = series(Array.from({ length: 120 }, (_, i) => 1000 * 1.002 ** i)).map(
      (bar, i, all) => ({
        ...bar,
        volume: i === all.length - 1 ? 300_000 : 1_000_000,
      }),
    )
    expect(analyze(bars).signals.map((s) => s.id)).toContain('low-volume')
  })

  it('出来高が無いままブレイクした場合は裏付けが取れないと書く', () => {
    const flat = Array.from({ length: 119 }, (_, i) => 1000 + (i % 2))
    const bars = series([...flat, 1100]).map((bar, i, all) => ({
      ...bar,
      volume: i === all.length - 1 ? 0 : 1_000_000,
    }))
    const breakout = analyze(bars).signals.find((s) => s.id === 'breakout')
    expect(breakout?.detail).toContain('確認できない')
    expect(breakout?.score).toBe(10)
  })
})
