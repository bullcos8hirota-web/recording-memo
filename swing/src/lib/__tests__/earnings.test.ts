import { describe, expect, it } from 'vitest'
import { earningsAlert } from '../market/earnings'

const now = new Date(2026, 7, 23) // 2026-08-23

describe('earningsAlert', () => {
  it('未登録ならnull', () => {
    expect(earningsAlert(null, now)).toBeNull()
    expect(earningsAlert(undefined, now)).toBeNull()
    expect(earningsAlert('', now)).toBeNull()
  })

  it('2週間以内なら近いと判定する', () => {
    expect(earningsAlert('2026-09-04', now)).toEqual({ days: 12, soon: true, past: false })
    expect(earningsAlert('2026-08-23', now)).toEqual({ days: 0, soon: true, past: false })
  })

  it('2週間より先なら警告しない', () => {
    expect(earningsAlert('2026-11-05', now)).toMatchObject({ soon: false, past: false })
  })

  it('過ぎていれば past にする', () => {
    expect(earningsAlert('2026-08-07', now)).toEqual({ days: -16, soon: false, past: true })
  })
})
