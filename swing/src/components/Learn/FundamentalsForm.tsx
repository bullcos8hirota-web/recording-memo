import type { Fundamentals } from '../../lib/learn/buffett'
import { Field, inputClass } from '../ui/Primitives'
import { HelpButton } from './HelpButton'

const NUMBER_FIELDS: {
  key: keyof Omit<Fundamentals, 'fcfPositive'>
  label: string
  term: string
  placeholder: string
}[] = [
  { key: 'roe', label: 'ROE(%)', term: 'roe', placeholder: '15' },
  { key: 'operatingMargin', label: '営業利益率(%)', term: 'operating-margin', placeholder: '12' },
  { key: 'equityRatio', label: '自己資本比率(%)', term: 'equity-ratio', placeholder: '55' },
  { key: 'epsGrowth', label: 'EPS成長率(年率%)', term: 'eps', placeholder: '8' },
  { key: 'debtToProfit', label: '有利子負債÷営業利益(年)', term: 'debt-to-profit', placeholder: '2' },
  { key: 'per', label: 'PER(倍)', term: 'per', placeholder: '15' },
  { key: 'pbr', label: 'PBR(倍)', term: 'pbr', placeholder: '1.5' },
]

const toText = (value: number | null): string => (value === null ? '' : String(value))

const toNumber = (text: string): number | null => {
  if (text.trim() === '') return null
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

/**
 * 財務データの入力欄。学ぶタブの練習用チェッカーと、銘柄ごとのカルテで共用する。
 */
export function FundamentalsForm({
  value,
  onChange,
}: {
  value: Fundamentals
  onChange: (next: Fundamentals) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {NUMBER_FIELDS.map((field) => (
        <Field key={field.key} label={field.label} help={field.term}>
          <input
            className={inputClass}
            value={toText(value[field.key])}
            onChange={(e) => onChange({ ...value, [field.key]: toNumber(e.target.value) })}
            inputMode="decimal"
            placeholder={field.placeholder}
          />
        </Field>
      ))}
      <div className="text-sm">
        <span className="inline-flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
          フリーCF
          <HelpButton term="free-cash-flow" label="フリーキャッシュフロー" />
        </span>
        <div className="mt-1 flex gap-2">
          {(
            [
              [true, 'プラス'],
              [false, 'マイナス'],
            ] as const
          ).map(([state, label]) => (
            <button
              key={label}
              type="button"
              onClick={() =>
                onChange({ ...value, fcfPositive: value.fcfPositive === state ? null : state })
              }
              className={`min-h-11 flex-1 rounded-lg border px-2 text-sm transition ${
                value.fcfPositive === state
                  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
                  : 'border-neutral-300 dark:border-neutral-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
