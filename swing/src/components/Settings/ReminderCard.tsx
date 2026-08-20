import { useState } from 'react'
import { buildIcs, googleCalendarUrl } from '../../lib/reminder'
import { buttonClass, Card, subtleButtonClass } from '../ui/Primitives'

const HOUR = 15
const MINUTE = 40

/**
 * 毎営業日の更新を忘れないための案内。
 * このアプリはサーバーを持たないためプッシュ通知を送れない。
 * 通知はカレンダーアプリに任せ、ここでは登録を1タップで済ませる。
 */
export function ReminderCard() {
  const [saved, setSaved] = useState(false)

  const downloadIcs = () => {
    const blob = new Blob([buildIcs(HOUR, MINUTE)], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'swing-update-reminder.ics'
    link.click()
    URL.revokeObjectURL(url)
    setSaved(true)
  }

  return (
    <Card
      title="更新のリマインダー"
      description="平日15:40に「終値を更新する」予定をカレンダーに入れます。通知はカレンダーアプリが出します。"
    >
      <div className="flex flex-wrap gap-2">
        <a
          className={buttonClass}
          href={googleCalendarUrl(HOUR, MINUTE)}
          target="_blank"
          rel="noreferrer"
        >
          Googleカレンダーに登録
        </a>
        <button type="button" className={subtleButtonClass} onClick={downloadIcs}>
          カレンダーファイル(.ics)
        </button>
      </div>
      {saved && (
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
          ダウンロードしたファイルを開くと、カレンダーアプリに取り込めます。
        </p>
      )}
      <p className="mt-3 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        このアプリから直接スマホに通知を出すことはできません。通知の配信にはサーバーが必要で、
        データを端末内だけに置く方針と両立しないためです。カレンダーの通知で代用してください。
      </p>
    </Card>
  )
}
