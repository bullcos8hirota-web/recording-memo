import { useEffect, useMemo, useState } from 'react'
import { db } from '../../lib/db'
import { useRecordingStore } from '../../stores/recordingStore'
import { RecordingItem } from './RecordingItem'

export function HistoryList() {
  const recordings = useRecordingStore((s) => s.recordings)
  const isLoading = useRecordingStore((s) => s.isLoading)
  const loadAll = useRecordingStore((s) => s.loadAll)
  const [query, setQuery] = useState('')
  const [searchTextByRecordingId, setSearchTextByRecordingId] = useState<Record<string, string>>(
    {},
  )

  useEffect(() => {
    loadAll()
  }, [loadAll])

  useEffect(() => {
    let cancelled = false

    if (recordings.length === 0) {
      setSearchTextByRecordingId({})
      return
    }

    Promise.all(
      recordings.map(async (recording) => {
        const [transcript, summary] = await Promise.all([
          db.transcripts.get(recording.id),
          db.summaries.get(recording.id),
        ])
        return [
          recording.id,
          [
            transcript?.fullText,
            summary?.overview,
            ...(summary?.keyPoints ?? []),
            ...(summary?.decisions ?? []),
            ...(summary?.actionItems ?? []),
          ]
            .filter(Boolean)
            .join(' ')
            .toLocaleLowerCase(),
        ] as const
      }),
    ).then((entries) => {
      if (!cancelled) setSearchTextByRecordingId(Object.fromEntries(entries))
    })

    return () => {
      cancelled = true
    }
  }, [recordings])

  const filteredRecordings = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return recordings.filter((recording) => {
      if (normalizedQuery.length === 0) return true
      return (
        recording.title.toLocaleLowerCase().includes(normalizedQuery) ||
        (searchTextByRecordingId[recording.id] ?? '').includes(normalizedQuery)
      )
    })
  }, [query, recordings, searchTextByRecordingId])

  return (
    <section className="mt-6">
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">保存したメモ</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {recordings.length}件。録音、AIメモ、文字起こしはこの端末に保存されます。
          </p>
        </div>
        <label className="block">
          <span className="sr-only">保存したメモを検索</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="保存したメモを検索"
            className="w-full rounded border border-neutral-300 bg-white px-3 py-3 text-base outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
      </div>

      {isLoading && <p className="mt-6 text-neutral-500">読み込み中...</p>}

      {!isLoading && recordings.length === 0 && (
        <p className="mt-6 rounded border border-dashed border-neutral-300 bg-white p-6 text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900">
          まだ録音がありません。上の録音ボタンからすぐに始められます。
        </p>
      )}

      {!isLoading && recordings.length > 0 && filteredRecordings.length === 0 && (
        <p className="mt-6 rounded border border-dashed border-neutral-300 bg-white p-6 text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900">
          一致するメモがありません。
        </p>
      )}

      {!isLoading && filteredRecordings.length > 0 && (
        <ul className="mt-4 space-y-4">
          {filteredRecordings.map((recording) => (
            <RecordingItem key={recording.id} recording={recording} />
          ))}
        </ul>
      )}
    </section>
  )
}
