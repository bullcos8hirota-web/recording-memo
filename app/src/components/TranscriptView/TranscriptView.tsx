import { useEffect, useState } from 'react'
import { useTranscriptStore } from '../../stores/transcriptStore'

interface TranscriptViewProps {
  recordingId: string
}

export function TranscriptView({ recordingId }: TranscriptViewProps) {
  const current = useTranscriptStore((s) => s.current)
  const load = useTranscriptStore((s) => s.load)
  const save = useTranscriptStore((s) => s.save)
  const [fullTextDraft, setFullTextDraft] = useState('')

  useEffect(() => {
    load(recordingId)
  }, [recordingId, load])

  useEffect(() => {
    if (current?.recordingId === recordingId) {
      setFullTextDraft(current.fullText)
    }
  }, [current, recordingId])

  if (!current || current.recordingId !== recordingId) {
    return <p className="mt-3 text-sm text-neutral-500">文字起こしを読み込み中です。</p>
  }

  const commitFullText = async () => {
    if (fullTextDraft !== current.fullText) {
      await save({
        ...current,
        fullText: fullTextDraft,
        segments:
          current.segments.length > 0
            ? current.segments
            : [{ start: 0, end: 0, text: fullTextDraft }],
        editedAt: Date.now(),
      })
    }
  }

  return (
    <div className="mt-4 space-y-2 rounded border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div>
        <h3 className="text-base font-semibold">文字起こし</h3>
        <p className="mt-1 text-xs text-neutral-500">
          必要なら修正できます。編集内容は自動で保存されます。
        </p>
      </div>
      <textarea
        value={fullTextDraft}
        onChange={(event) => setFullTextDraft(event.target.value)}
        onBlur={commitFullText}
        rows={8}
        className="w-full resize-y rounded border border-neutral-300 bg-white px-3 py-2 text-sm leading-6 dark:border-neutral-700 dark:bg-neutral-900"
        placeholder="文字起こしはまだありません。"
      />
    </div>
  )
}
