/**
 * 更新を忘れないためのリマインダー。
 * サーバーを持たないアプリなので、端末に届くプッシュ通知は作れない。
 * 代わりに、カレンダーアプリに毎営業日の予定を登録してもらい、
 * 通知はカレンダーに任せる。
 */

const TITLE = '株価の終値を更新'
const DETAIL = 'スイングトレード支援アプリを開いて「まとめて終値を更新」'

const pad = (value: number): string => String(value).padStart(2, '0')

/** Googleカレンダーやicsが使う UTC の時刻表記(20260820T064000Z)。 */
const toUtcStamp = (date: Date): string =>
  `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T` +
  `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00Z`

/** 次に来る平日の指定時刻(端末のタイムゾーン基準)。 */
export function nextWeekdayAt(hour: number, minute: number, now = new Date()): Date {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0)
  if (start <= now) start.setDate(start.getDate() + 1)
  while (start.getDay() === 0 || start.getDay() === 6) {
    start.setDate(start.getDate() + 1)
  }
  return start
}

/** Googleカレンダーの登録画面を開くURL。平日繰り返しの予定を用意する。 */
export function googleCalendarUrl(hour: number, minute: number, now = new Date()): string {
  const start = nextWeekdayAt(hour, minute, now)
  const end = new Date(start.getTime() + 10 * 60 * 1000)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: TITLE,
    details: DETAIL,
    dates: `${toUtcStamp(start)}/${toUtcStamp(end)}`,
    recur: 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/** カレンダーアプリに取り込む .ics の中身。10分前に通知する設定を入れる。 */
export function buildIcs(hour: number, minute: number, now = new Date()): string {
  const start = nextWeekdayAt(hour, minute, now)
  const end = new Date(start.getTime() + 10 * 60 * 1000)
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//swing-trade//JP',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:swing-update-${toUtcStamp(start)}@swing-trade`,
    `DTSTAMP:${toUtcStamp(now)}`,
    `DTSTART:${toUtcStamp(start)}`,
    `DTEND:${toUtcStamp(end)}`,
    'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
    `SUMMARY:${TITLE}`,
    `DESCRIPTION:${DETAIL}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT0M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${TITLE}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}
