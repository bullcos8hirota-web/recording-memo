import { useEffect } from 'react'
import { useRecordingStore } from '../../stores/recordingStore'
import { RecordingItem } from './RecordingItem'

export function HistoryList() {
  const recordings = useRecordingStore((s) => s.recordings)
  const isLoading = useRecordingStore((s) => s.isLoading)
  const loadAll = useRecordingStore((s) => s.loadAll)

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
        <RecordingItem key={r.id} recording={r} />
      ))}
    </ul>
  )
}
