import { describe, expect, it } from 'vitest'
import { suspiciousJumps } from '../market/importCheck'
import type { Bar } from '../market/types'

const bar = (date: string, close: number): Bar => ({
  date,
  open: close,
  high: close,
  low: close,
  close,
  volume: 1_000,
})

describe('suspiciousJumps', () => {
  it('普通の値動きなら何も出さない', () => {
    const existing = [bar('2026-08-24', 3_125)]
    expect(suspiciousJumps(existing, [bar('2026-08-25', 3_160)])).toEqual([])
  })

  it('別銘柄を貼ったときのような継ぎ目を見つける', () => {
    const existing = [bar('2026-08-24', 3_125)]
    const jumps = suspiciousJumps(existing, [bar('2026-08-25', 2_910)])
    expect(jumps).toHaveLength(1)
    expect(jumps[0].date).toBe('2026-08-25')
    expect(jumps[0].changeRate).toBeCloseTo(-6.88, 1)
  })

  it('取り込む側の中で跳ねていても見つける', () => {
    const jumps = suspiciousJumps([], [bar('2026-08-24', 1_000), bar('2026-08-25', 1_200)])
    expect(jumps.map((jump) => jump.date)).toEqual(['2026-08-25'])
  })

  it('前からあるデータどうしの継ぎ目は見ない', () => {
    const existing = [bar('2026-08-20', 1_000), bar('2026-08-21', 1_300)]
    expect(suspiciousJumps(existing, [bar('2026-08-25', 1_320)])).toEqual([])
  })

  it('データが無ければ何も出さない', () => {
    expect(suspiciousJumps([], [])).toEqual([])
  })
})
