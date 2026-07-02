import { useEffect } from 'react'
import { useRecordingStore } from '../../stores/recordingStore'

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const STATUS_LABEL: Record<string, string> = {
  recording: '録音中',
  recorded: '録音済み',
  transcribing: '文字起こし中',
  transcribed: '文字起こし完了',
  summarizing: '要約中',
  done: '完了',
  error: 'エラー',
}

export function HistoryList() {
  const recordings = useRecordingStore((s) => s.recordings)
  const isLoading = useRecordingStore((s) => s.isLoading)
  const loadAll = useRecordingStore((s) => s.loadAll)
  const remove = useRecordingStore((s) => s.remove)

  useEffect(() => {
    loadAll()
  }, [loadAll])

  if (isLoading) {
    return <p className="mt-6 text-neutral-500">読み込み中...</p>
  }

  if (recordings.length === 0) {
    return <p className="mt-6 text-neutral-500">まだ録音がありません</p>
  }

  return (
    <ul className="mt-6 divide-y divide-neutral-200 dark:divide-neutral-800">
      {recordings.map((r) => (
        <li key={r.id} className="flex items-center justify-between py-3">
          <div>
            <p className="font-medium">{r.title}</p>
            <p className="text-sm text-neutral-500">
              {new Date(r.createdAt).toLocaleString('ja-JP')} ・{' '}
              {formatDuration(r.durationMs)} ・ {STATUS_LABEL[r.status] ?? r.status}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (confirm(`「${r.title}」を削除しますか？`)) remove(r.id)
            }}
            className="text-sm text-red-600 hover:underline"
          >
            削除
          </button>
        </li>
      ))}
    </ul>
  )
}
