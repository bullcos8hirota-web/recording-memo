import { useEffect, useState } from 'react'
import { useTranscriptStore } from '../../stores/transcriptStore'

interface TranscriptViewProps {
  recordingId: string
}

export function TranscriptView({ recordingId }: TranscriptViewProps) {
  const current = useTranscriptStore((s) => s.current)
  const load = useTranscriptStore((s) => s.load)
  const save = useTranscriptStore((s) => s.save)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [draftText, setDraftText] = useState('')

  useEffect(() => {
    load(recordingId)
  }, [recordingId, load])

  if (!current || current.recordingId !== recordingId) {
    return <p className="mt-3 text-sm text-neutral-500">読み込み中...</p>
  }

  const startEdit = (index: number) => {
    setEditingIndex(index)
    setDraftText(current.segments[index].text)
  }

  const commitEdit = async () => {
    if (editingIndex === null) return
    const segments = current.segments.map((seg, i) =>
      i === editingIndex ? { ...seg, text: draftText } : seg,
    )
    const fullText = segments.map((s) => s.text).join(' ')
    await save({ ...current, segments, fullText, editedAt: Date.now() })
    setEditingIndex(null)
  }

  return (
    <div className="mt-3 space-y-2 rounded border border-neutral-200 p-3 dark:border-neutral-800">
      {current.segments.length === 0 && (
        <p className="text-sm text-neutral-500">文字起こし結果がありません</p>
      )}
      {current.segments.map((segment, index) => (
        <div key={`${segment.start}-${index}`} className="flex gap-3 text-sm">
          <span className="w-12 shrink-0 font-mono text-neutral-400">
            {Math.floor(segment.start)}s
          </span>
          {editingIndex === index ? (
            <div className="flex flex-1 gap-2">
              <input
                autoFocus
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit()
                  if (e.key === 'Escape') setEditingIndex(null)
                }}
                className="flex-1 rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
              />
              <button type="button" onClick={commitEdit} className="text-blue-600">
                保存
              </button>
            </div>
          ) : (
            <p
              onClick={() => startEdit(index)}
              className="flex-1 cursor-text hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              {segment.text}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
