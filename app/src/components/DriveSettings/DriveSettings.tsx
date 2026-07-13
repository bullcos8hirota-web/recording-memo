import { useEffect, useState } from 'react'
import {
  getStoredGoogleClientId,
  saveGoogleClientId,
} from '../../lib/drive/googleDrive'

export function DriveSettings() {
  const [open, setOpen] = useState(false)
  const [clientId, setClientId] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setClientId(getStoredGoogleClientId())
  }, [])

  const connected = getStoredGoogleClientId().length > 0

  const save = () => {
    saveGoogleClientId(clientId)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }

  return (
    <section className="mb-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between text-left"
      >
        <span>
          <span className="block text-sm font-semibold">Googleドキュメント保存</span>
          <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">
            {connected
              ? '設定済み。録音カードからGoogleドキュメントとしてDriveに保存できます。'
              : '設定すると、録音カードからGoogleドキュメント形式でDriveに保存できます。'}
          </span>
        </span>
        <span className="text-sm text-neutral-500">{open ? '閉じる' : '設定'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-neutral-500">
              Google OAuth クライアントID
            </span>
            <input
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              placeholder="xxxxx.apps.googleusercontent.com"
              className="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-950"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={save}
              className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              保存
            </button>
            {saved && <span className="text-sm text-blue-600">保存しました</span>}
          </div>
          <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            Google Cloud Consoleで「Web アプリケーション」用のOAuthクライアントIDを作成し、
            承認済みJavaScript生成元にこのアプリのURLを追加してください。
            Gemini課金とは別に、Drive保存自体は無料です。保存時にGoogleの同意画面が開きます。
          </p>
        </div>
      )}
    </section>
  )
}
