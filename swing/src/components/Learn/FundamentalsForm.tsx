import { useEffect, useState } from 'react'
import {
  EMPTY_STATEMENTS,
  fromStatements,
  type Fundamentals,
  type Statements,
} from '../../lib/learn/buffett'
import { parseFundamentalsText } from '../../lib/learn/parseFundamentals'
import { readClipboard } from '../../lib/clipboard'
import { Field, inputClass, subtleButtonClass } from '../ui/Primitives'
import { HelpButton } from './HelpButton'

const NUMBER_FIELDS: {
  key: keyof Omit<Fundamentals, 'fcfPositive'>
  label: string
  term: string
  placeholder: string
  /** どこを見れば載っているか。載っていないことが多いものは計算式を書く。 */
  source: string
}[] = [
  {
    key: 'per',
    label: 'PER(倍)',
    term: 'per',
    placeholder: '15',
    source: '株価ページの参考指標',
  },
  {
    key: 'pbr',
    label: 'PBR(倍)',
    term: 'pbr',
    placeholder: '1.5',
    source: '株価ページの参考指標',
  },
  {
    key: 'roe',
    label: 'ROE(%)',
    term: 'roe',
    placeholder: '15',
    source: '無ければ 純利益 ÷ 自己資本（下で計算できます）',
  },
  {
    key: 'operatingMargin',
    label: '営業利益率(%)',
    term: 'operating-margin',
    placeholder: '12',
    source: '営業利益 ÷ 売上高（下で計算できます）',
  },
  {
    key: 'equityRatio',
    label: '自己資本比率(%)',
    term: 'equity-ratio',
    placeholder: '55',
    source: '自己資本 ÷ 総資産（下で計算できます）',
  },
  {
    key: 'epsGrowth',
    label: 'EPS成長率(年率%)',
    term: 'eps',
    placeholder: '8',
    source: '業績のEPS推移から。3年で1.3倍なら年率9%くらい',
  },
  {
    key: 'debtToProfit',
    label: '有利子負債÷営業利益(年)',
    term: 'debt-to-profit',
    placeholder: '2',
    source: '有利子負債 ÷ 営業利益（下で計算できます）',
  },
]

const LABEL_OF: Partial<Record<keyof Fundamentals, string>> = {
  roe: 'ROE',
  operatingMargin: '営業利益率',
  equityRatio: '自己資本比率',
  epsGrowth: 'EPS成長率',
  debtToProfit: '有利子負債÷営業利益',
  per: 'PER',
  pbr: 'PBR',
}

const STATEMENT_FIELDS: { key: keyof Statements; label: string }[] = [
  { key: 'revenue', label: '売上高' },
  { key: 'operatingProfit', label: '営業利益' },
  { key: 'netProfit', label: '純利益' },
  { key: 'equity', label: '自己資本(純資産)' },
  { key: 'assets', label: '総資産' },
  { key: 'debt', label: '有利子負債' },
]

const toText = (value: number | null): string =>
  value === null ? '' : String(value)

const toNumber = (text: string): number | null => {
  if (text.trim() === '') return null
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

/**
 * 未入力(null)を許す数値入力。入力中の文字列をそのまま保持するので、
 * 「16.5」を打つ途中の「16.」が勝手に「16」へ戻ることがない。
 */
function NullableNumberInput({
  value,
  onCommit,
  placeholder,
}: {
  value: number | null
  onCommit: (value: number | null) => void
  placeholder: string
}) {
  const [text, setText] = useState(() => toText(value))

  useEffect(() => {
    setText((current) =>
      toNumber(current) === value ? current : toText(value),
    )
  }, [value])

  return (
    <input
      className={inputClass}
      value={text}
      inputMode="decimal"
      placeholder={placeholder}
      onChange={(event) => {
        const raw = event.target.value
        setText(raw)
        if (raw.trim() === '') {
          onCommit(null)
          return
        }
        const parsed = toNumber(raw)
        if (parsed !== null) onCommit(parsed)
      }}
      onBlur={() => setText(toText(value))}
    />
  )
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
    <div>
      <div className="grid grid-cols-2 gap-3">
        {NUMBER_FIELDS.map((field) => (
          <Field
            key={field.key}
            label={field.label}
            help={field.term}
            hint={field.source}
          >
            <NullableNumberInput
              value={value[field.key]}
              onCommit={(next) => onChange({ ...value, [field.key]: next })}
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
                  onChange({
                    ...value,
                    fcfPositive: value.fcfPositive === state ? null : state,
                  })
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

      <PasteFundamentals value={value} onChange={onChange} />

      <StatementCalculator
        onFill={(patch) => onChange({ ...value, ...patch })}
      />
    </div>
  )
}

/**
 * 企業情報のページをそのまま貼って、拾える数字だけ入れる。
 * どの数字がどの欄なのかを覚えるより、貼って確認するほうが早い。
 */
function PasteFundamentals({
  value,
  onChange,
}: {
  value: Fundamentals
  onChange: (next: Fundamentals) => void
}) {
  const [text, setText] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const parsed = text.trim() === '' ? null : parseFundamentalsText(text)
  const derived = fromStatements({
    ...EMPTY_STATEMENTS,
    ...(parsed?.statements ?? {}),
  })
  // 直接書いてある比率を優先し、決算の金額からの計算は足りないところだけ埋める。
  const filled: Partial<Fundamentals> = {
    ...derived,
    ...(parsed?.ratios ?? {}),
  }
  const found = Object.entries(filled).filter(
    ([, item]) => item !== null && item !== undefined,
  )

  const apply = () => {
    onChange({ ...value, ...Object.fromEntries(found) })
    setText('')
    setMessage(`${found.length}項目を入れました。`)
  }

  return (
    <div className="mt-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <p className="text-sm font-medium">企業情報を貼り付ける</p>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        SBI証券の四季報や企業情報の画面を、範囲を気にせずまるごと貼ってください。
        見出しを手がかりに、使える数字だけ拾います。
      </p>
      <button
        type="button"
        className={`${subtleButtonClass} mt-2`}
        onClick={async () => {
          const clip = await readClipboard()
          setMessage(clip.ok ? null : clip.reason)
          if (clip.ok) setText(clip.text)
        }}
      >
        クリップボードから貼り付け
      </button>
      <textarea
        className={`${inputClass} mt-2 min-h-24 font-mono text-xs`}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setMessage(null)
        }}
        placeholder={'ROE(実績)\n9.82%\n自己資本比率\n55.2%'}
      />
      {parsed && (
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          {found.length === 0
            ? '使える数字が見つかりませんでした。別の画面を貼るか、下の欄に手で入れてください。'
            : found
                .map(
                  ([key, item]) =>
                    `${LABEL_OF[key as keyof Fundamentals] ?? key} ${item}`,
                )
                .join(' / ')}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={subtleButtonClass}
          disabled={found.length === 0}
          onClick={apply}
        >
          上の欄に入れる
        </button>
        {message && (
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {message}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * ROEや自己資本比率は「決算には載っているが、株価サイトには出ていない」ことが多い。
 * 金額を入れれば比率にして流し込む。単位は揃っていれば何でもよい。
 */
function StatementCalculator({
  onFill,
}: {
  onFill: (patch: ReturnType<typeof fromStatements>) => void
}) {
  const [open, setOpen] = useState(false)
  const [statements, setStatements] = useState<Statements>(EMPTY_STATEMENTS)
  const result = fromStatements(statements)
  const ready = Object.values(result).some((item) => item !== null)

  if (!open) {
    return (
      <button
        type="button"
        className={`${subtleButtonClass} mt-3`}
        onClick={() => setOpen(true)}
      >
        ROE・自己資本比率などを決算の金額から計算する
      </button>
    )
  }

  return (
    <div className="mt-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <p className="text-sm font-medium">決算の金額から計算する</p>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        決算短信や業績ページに載っている金額を入れてください。
        単位は揃っていれば何でも構いません(全部「百万円」など)。比率なので単位は消えます。
      </p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        {STATEMENT_FIELDS.map((field) => (
          <Field key={field.key} label={field.label}>
            <NullableNumberInput
              value={statements[field.key]}
              onCommit={(next) =>
                setStatements({ ...statements, [field.key]: next })
              }
              placeholder="0"
            />
          </Field>
        ))}
      </div>
      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        ROE {result.roe ?? '—'}% / 営業利益率 {result.operatingMargin ?? '—'}% /
        自己資本比率 {result.equityRatio ?? '—'}% / 有利子負債÷営業利益{' '}
        {result.debtToProfit ?? '—'}年
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className={subtleButtonClass}
          disabled={!ready}
          onClick={() => onFill(result)}
        >
          上の欄に入れる
        </button>
        <button
          type="button"
          className={subtleButtonClass}
          onClick={() => setOpen(false)}
        >
          閉じる
        </button>
      </div>
    </div>
  )
}
