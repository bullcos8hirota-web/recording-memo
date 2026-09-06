import { useRef, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { db } from '../../lib/db'
import {
  backupFileName,
  buildBackup,
  describeBackup,
  parseBackup,
  type Backup,
} from '../../lib/db/backup'
import { Card, subtleButtonClass } from '../ui/Primitives'

/**
 * 端末の中身を1ファイルに書き出す・読み戻す。
 * このアプリのデータは端末の中にしかないので、機種変更やサイトデータの削除で消える。
 */
export function BackupCard() {
  const settings = useAppStore((s) => s.settings)
  const restoreBackup = useAppStore((s) => s.restoreBackup)
  const [includeApiKey, setIncludeApiKey] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, setPending] = useState<Backup | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const save = async () => {
    setMessage(null)
    setPending(null)
    try {
      const [stocks, series, trades] = await Promise.all([
        db.stocks.toArray(),
        db.series.toArray(),
        db.trades.toArray(),
      ])
      const backup = buildBackup({ settings, stocks, series, trades, includeApiKey })
      const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = backupFileName()
      link.click()
      URL.revokeObjectURL(url)
      setMessage({ ok: true, text: `${describeBackup(backup)} を書き出しました。` })
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : String(error) })
    }
  }

  const pick = async (file: File) => {
    setMessage(null)
    try {
      setPending(parseBackup(await file.text()))
    } catch (error) {
      setPending(null)
      setMessage({ ok: false, text: error instanceof Error ? error.message : String(error) })
    }
  }

  const restore = async () => {
    if (!pending) return
    await restoreBackup(pending)
    setMessage({ ok: true, text: '読み込みました。今の中身はファイルの内容に置き換わりました。' })
    setPending(null)
  }

  return (
    <Card
      title="バックアップ"
      description="このアプリのデータは、この端末のブラウザの中にしかありません。機種変更やサイトデータの削除で消えるので、ときどき書き出しておいてください。"
    >
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={subtleButtonClass} onClick={() => void save()}>
          ファイルに書き出す
        </button>
        <button
          type="button"
          className={subtleButtonClass}
          onClick={() => fileInput.current?.click()}
        >
          ファイルから読み込む
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void pick(file)
            e.target.value = ''
          }}
        />
      </div>

      {settings.jquantsApiKey && (
        <label className="mt-3 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={includeApiKey}
            onChange={(e) => setIncludeApiKey(e.target.checked)}
          />
          <span>
            J-QuantsのAPIキーも書き出す
            <span className="block text-xs text-slate-600 dark:text-slate-300">
              入れておくと新しい端末でそのまま使えます。ファイルを人に渡すなら外してください。
            </span>
          </span>
        </label>
      )}

      {pending && (
        <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-medium">読み込むと、今の中身は消えます</p>
          <p className="mt-1">{describeBackup(pending)}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={subtleButtonClass} onClick={() => void restore()}>
              置き換える
            </button>
            <button type="button" className={subtleButtonClass} onClick={() => setPending(null)}>
              やめる
            </button>
          </div>
        </div>
      )}

      {message && (
        <p
          className={`mt-2 text-sm ${
            message.ok
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-rose-700 dark:text-rose-300'
          }`}
        >
          {message.text}
        </p>
      )}
    </Card>
  )
}
