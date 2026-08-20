import { describe, expect, it } from 'vitest'
import { buildIcs, googleCalendarUrl, nextWeekdayAt } from '../reminder'

describe('nextWeekdayAt', () => {
  it('その日の時刻がまだなら当日', () => {
    const result = nextWeekdayAt(15, 40, new Date('2026-08-20T09:00:00'))
    expect(result.getDate()).toBe(20)
    expect(result.getHours()).toBe(15)
    expect(result.getMinutes()).toBe(40)
  })

  it('過ぎていれば翌営業日', () => {
    expect(nextWeekdayAt(15, 40, new Date('2026-08-20T16:00:00')).getDate()).toBe(21)
  })

  it('土日を飛ばす', () => {
    // 8/21(金)の夕方 → 次は8/24(月)
    expect(nextWeekdayAt(15, 40, new Date('2026-08-21T16:00:00')).getDate()).toBe(24)
  })
})

describe('カレンダー連携', () => {
  it('Googleカレンダーのリンクに平日繰り返しが入る', () => {
    const url = googleCalendarUrl(15, 40, new Date('2026-08-20T09:00:00'))
    expect(url).toContain('calendar.google.com')
    expect(decodeURIComponent(url)).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')
    expect(decodeURIComponent(url)).toContain('株価の終値を更新')
  })

  it('icsが必要な行を含む', () => {
    const ics = buildIcs(15, 40, new Date('2026-08-20T09:00:00'))
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')
    expect(ics).toContain('BEGIN:VALARM')
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
  })
})
