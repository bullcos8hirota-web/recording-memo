import { useEffect, useState } from 'react'
import { readTheme, storeTheme, watchSystemTheme, type ThemeChoice } from '../../lib/theme'
import { Card } from '../ui/Primitives'

const CHOICES: { id: ThemeChoice; label: string; hint: string }[] = [
  { id: 'system', label: '端末に合わせる', hint: 'スマホの設定に従います' },
  { id: 'light', label: '明るい', hint: '白い背景' },
  { id: 'dark', label: '暗い', hint: '濃紺の背景' },
]

/** 画面の明るさ。端末ごと変えずに、このアプリだけ切り替えられるようにする。 */
export function ThemeCard() {
  const [choice, setChoice] = useState<ThemeChoice>(readTheme)

  useEffect(() => watchSystemTheme(() => choice), [choice])

  return (
    <Card title="画面の明るさ">
      <div className="grid grid-cols-3 gap-2">
        {CHOICES.map((item) => {
          const active = item.id === choice
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setChoice(item.id)
                storeTheme(item.id)
              }}
              className={`min-h-11 rounded-xl border px-2 py-2 text-sm font-medium transition ${
                active
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                  : 'border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700'
              }`}
            >
              {item.label}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
        {CHOICES.find((item) => item.id === choice)?.hint}
      </p>
    </Card>
  )
}
