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
        className="flex w-full items-center justify-between gap-3 overflow-hidden text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">
            Googleドキュメント保存
          </span>
          <span className="mt-1 block whitespace-normal break-words text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            {connected
              ? '設定済み。録音カードからGoogleドキュメントとしてDriveに保存できます。'
              : 'Driveへ直接保存したい場合だけ設定します。通常の共有・保存では設定不要です。'}
          </span>
        </span>
        <span className="shrink-0 text-sm text-neutral-500">
          {open ? '閉じる' : '設定'}
        </span>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <div className="rounded border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">
            <p className="font-semibold">
              ここに入れるのはGemini APIキーではありません。
            </p>
            <p className="mt-1">
              Google Cloudで作成した「ウェブアプリケーション」用のOAuth 2.0
              クライアントIDを入力します。Google
              Driveへ直接保存しない場合は空欄で構いません。
            </p>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-neutral-500">
              Google OAuth 2.0 クライアントID（任意）
            </span>
            <input
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              placeholder="xxxxx.apps.googleusercontent.com"
              className="mt-1 min-w-0 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-950"
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
            {saved && (
              <span className="text-sm text-blue-600">保存しました</span>
            )}
          </div>
          <div className="space-y-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            <p>
              作成する場合はGoogle CloudでDrive
              APIを有効にし、OAuthクライアントの種類を 「ウェブ
              アプリケーション」にします。
            </p>
            <p>
              「承認済みのJavaScript生成元」には
              <code className="mx-1 break-all rounded bg-neutral-100 px-1 py-0.5 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                https://bullcos8hirota-web.github.io
              </code>
              を登録します。
            </p>
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-blue-600 underline dark:text-blue-400"
            >
              Google Cloudの認証情報を開く
            </a>
          </div>
        </div>
      )}
    </section>
  )
}
