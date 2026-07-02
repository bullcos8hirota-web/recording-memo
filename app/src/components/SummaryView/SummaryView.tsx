import { useEffect, useState } from 'react'
import { useSummaryStore } from '../../stores/summaryStore'

interface EditableListProps {
  label: string
  items: string[]
  onChange: (items: string[]) => void
}

function EditableList({ label, items, onChange }: EditableListProps) {
  const updateItem = (index: number, value: string) => {
    const next = [...items]
    next[index] = value
    onChange(next)
  }
  const removeItem = (index: number) => onChange(items.filter((_, i) => i !== index))
  const addItem = () => onChange([...items, ''])

  return (
    <div>
      <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">{label}</p>
      {items.length === 0 && <p className="text-sm text-neutral-400">なし</p>}
      <ul className="mt-1 space-y-1">
        {items.map((item, index) => (
          <li key={index} className="flex gap-2">
            <input
              value={item}
              onChange={(e) => updateItem(index, e.target.value)}
              className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            />
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="text-xs text-red-600 hover:underline"
            >
              削除
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={addItem} className="mt-1 text-xs text-blue-600 hover:underline">
        + 追加
      </button>
    </div>
  )
}

interface SummaryViewProps {
  recordingId: string
  onRegenerate: () => void
  regenerating: boolean
}

export function SummaryView({ recordingId, onRegenerate, regenerating }: SummaryViewProps) {
  const current = useSummaryStore((s) => s.current)
  const load = useSummaryStore((s) => s.load)
  const save = useSummaryStore((s) => s.save)
  const [overviewDraft, setOverviewDraft] = useState('')

  useEffect(() => {
    load(recordingId)
  }, [recordingId, load])

  useEffect(() => {
    if (current?.recordingId === recordingId) {
      setOverviewDraft(current.overview)
    }
  }, [current, recordingId])

  if (!current || current.recordingId !== recordingId) {
    return <p className="mt-3 text-sm text-neutral-500">要約がまだありません</p>
  }

  const commitOverview = () => {
    if (overviewDraft !== current.overview) {
      save({ ...current, overview: overviewDraft, editedAt: Date.now() })
    }
  }

  return (
    <div className="mt-3 space-y-4 rounded border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">概要</p>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={regenerating}
          className="text-xs text-blue-600 hover:underline disabled:opacity-50"
        >
          再実行
        </button>
      </div>
      <textarea
        value={overviewDraft}
        onChange={(e) => setOverviewDraft(e.target.value)}
        onBlur={commitOverview}
        rows={3}
        className="w-full rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />

      <EditableList
        label="主な論点"
        items={current.keyPoints}
        onChange={(keyPoints) => save({ ...current, keyPoints, editedAt: Date.now() })}
      />
      <EditableList
        label="決定事項"
        items={current.decisions}
        onChange={(decisions) => save({ ...current, decisions, editedAt: Date.now() })}
      />
      <EditableList
        label="アクションアイテム"
        items={current.actionItems}
        onChange={(actionItems) => save({ ...current, actionItems, editedAt: Date.now() })}
      />
    </div>
  )
}
