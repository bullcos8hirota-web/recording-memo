import { describe, expect, it } from 'vitest'
import { comingFriday } from '../format'

describe('comingFriday', () => {
  it('平日ならその週の金曜', () => {
    expect(comingFriday(new Date(2026, 7, 25))).toBe('2026-08-28') // 火
    expect(comingFriday(new Date(2026, 7, 24))).toBe('2026-08-28') // 月
  })

  it('金曜なら当日', () => {
    expect(comingFriday(new Date(2026, 7, 28))).toBe('2026-08-28')
  })

  it('土日なら翌週の金曜', () => {
    expect(comingFriday(new Date(2026, 7, 29))).toBe('2026-09-04') // 土
    expect(comingFriday(new Date(2026, 7, 30))).toBe('2026-09-04') // 日
  })
})
