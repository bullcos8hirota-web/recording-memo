import { describe, expect, it } from 'vitest'
import { lastExpectedTradingDate, missingTradingDays } from '../market/freshness'

const at = (iso: string) => new Date(iso)

describe('lastExpectedTradingDate', () => {
  it('平日の引け後は当日', () => {
    expect(lastExpectedTradingDate(at('2026-08-20T15:40:00'))).toBe('2026-08-20')
    expect(lastExpectedTradingDate(at('2026-08-20T23:00:00'))).toBe('2026-08-20')
  })

  it('平日でも引け前は前営業日', () => {
    expect(lastExpectedTradingDate(at('2026-08-20T09:00:00'))).toBe('2026-08-19')
    expect(lastExpectedTradingDate(at('2026-08-20T15:39:00'))).toBe('2026-08-19')
  })

  it('土日は金曜日', () => {
    expect(lastExpectedTradingDate(at('2026-08-22T10:00:00'))).toBe('2026-08-21')
    expect(lastExpectedTradingDate(at('2026-08-23T10:00:00'))).toBe('2026-08-21')
  })

  it('月曜の朝は前週金曜', () => {
    expect(lastExpectedTradingDate(at('2026-08-24T08:00:00'))).toBe('2026-08-21')
  })
})

describe('missingTradingDays', () => {
  it('最新なら0', () => {
    expect(missingTradingDays('2026-08-20', at('2026-08-20T16:00:00'))).toBe(0)
    expect(missingTradingDays('2026-08-19', at('2026-08-20T09:00:00'))).toBe(0)
  })

  it('入れ忘れた営業日の数を返す', () => {
    expect(missingTradingDays('2026-08-19', at('2026-08-20T16:00:00'))).toBe(1)
    expect(missingTradingDays('2026-08-17', at('2026-08-20T16:00:00'))).toBe(3)
  })

  it('土日は数えない', () => {
    // 8/21(金)まで入っていて、次の月曜の引け後
    expect(missingTradingDays('2026-08-21', at('2026-08-24T16:00:00'))).toBe(1)
  })
})
