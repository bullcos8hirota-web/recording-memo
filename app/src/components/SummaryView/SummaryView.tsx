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
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">{label}</h4>
        <button
          type="button"
          onClick={addItem}
          className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          追加
        </button>
      </div>
      {items.length === 0 && <p className="text-sm text-neutral-400">なし</p>}
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex gap-2">
            <textarea
              value={item}
              onChange={(event) => updateItem(index, event.target.value)}
              rows={2}
              className="min-h-11 flex-1 resize-y rounded border border-neutral-300 bg-white px-3 py-2 text-sm leading-6 dark:border-neutral-700 dark:bg-neutral-900"
            />
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="shrink-0 rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
            >
              削除
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

interface SummaryViewProps {
  recordingId: string
  onRegenerate: () => void | Promise<void>
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
    return <p className="mt-3 text-sm text-neutral-500">メモを読み込み中です。</p>
  }

  const commitOverview = () => {
    if (overviewDraft !== current.overview) {
      save({ ...current, overview: overviewDraft, editedAt: Date.now() })
    }
  }

  return (
    <div className="mt-4 space-y-5 rounded border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">AIメモ</h3>
          <p className="mt-1 text-xs text-neutral-500">
            必要ならこのまま編集できます。編集内容は自動で保存されます。
          </p>
        </div>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={regenerating}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          作り直す
        </button>
      </div>

      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">要約</h4>
        <textarea
          value={overviewDraft}
          onChange={(event) => setOverviewDraft(event.target.value)}
          onBlur={commitOverview}
          rows={5}
          className="w-full resize-y rounded border border-neutral-300 bg-white px-3 py-2 text-sm leading-6 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </section>

      <EditableList
        label="大事なこと"
        items={current.keyPoints}
        onChange={(keyPoints) => save({ ...current, keyPoints, editedAt: Date.now() })}
      />
      <EditableList
        label="決まったこと"
        items={current.decisions}
        onChange={(decisions) => save({ ...current, decisions, editedAt: Date.now() })}
      />
      <EditableList
        label="次にやること"
        items={current.actionItems}
        onChange={(actionItems) => save({ ...current, actionItems, editedAt: Date.now() })}
      />
    </div>
  )
}
