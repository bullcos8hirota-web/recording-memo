import { useEffect, useState, type ReactNode } from 'react'
import { HelpButton } from '../Learn/HelpButton'

export function Card({
  title,
  description,
  actions,
  children,
}: {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-5">
      {(title || actions) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {description && (
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export function Stat({
  label,
  value,
  hint,
  tone,
  help,
}: {
  label: string
  value: ReactNode
  hint?: string
  tone?: string
  /** 用語集のID。渡すとラベルの横に「?」が出る。 */
  help?: string
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-700/40">
      <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
        <span>{label}</span>
        {help && <HelpButton term={help} label={label} />}
      </div>
      <div className={`mt-0.5 text-base font-semibold tabular-nums ${tone ?? ''}`}>
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">{hint}</div>
      )}
    </div>
  )
}

export function Field({
  label,
  hint,
  className,
  help,
  children,
}: {
  label: string
  hint?: string
  className?: string
  /** 用語集のID。渡すとラベルの横に「?」が出る。 */
  help?: string
  children: ReactNode
}) {
  return (
    <label className={`block text-sm ${className ?? ''}`}>
      <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
        {label}
        {help && <HelpButton term={help} label={label} />}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-xs text-slate-600 dark:text-slate-300">{hint}</span>
      )}
    </label>
  )
}

// text-base(16px)にしておかないと、iOS Safariが入力欄にフォーカスした瞬間に拡大する。
export const inputClass =
  'mt-1 w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base tabular-nums outline-none focus:border-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:focus:border-slate-300 sm:text-sm'

export const buttonClass =
  'inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300'

export const subtleButtonClass =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-100 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-700'

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'bull' | 'bear' | 'info' | 'neutral'
}) {
  const tones = {
    bull: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
    bear: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
    info: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
    neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  } as const
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

/**
 * 押すと開く見出し。読まなくてよいものを畳んでおくために使う。
 * 押せる範囲は44px以上にする(指で確実に当たる大きさ)。
 */
export function Disclosure({
  summary,
  detail,
  children,
  defaultOpen = false,
}: {
  summary: string
  /** 畳んだままでも見えるひとこと。 */
  detail?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-1 text-left transition hover:bg-slate-100 active:opacity-80 dark:hover:bg-slate-700/50"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium">{summary}</span>
          {detail && (
            <span className="block text-sm text-slate-600 dark:text-slate-300">{detail}</span>
          )}
        </span>
        <span
          aria-hidden
          className={`shrink-0 text-slate-500 transition-transform dark:text-slate-400 ${
            open ? 'rotate-90' : ''
          }`}
        >
          ›
        </span>
      </button>
      {open && <div className="px-1 pb-2">{children}</div>}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center dark:border-slate-600">
      <p className="font-medium">{title}</p>
      {children && (
        <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{children}</div>
      )}
    </div>
  )
}

/**
 * 数値の入力欄。入力中の文字列をそのまま持ち、確定できる値になったときだけ通知する。
 * 数値を直接 value に流し込むと「1.5」を打つ途中の「1.」が「1」に戻され、
 * 小数が入力できなくなるため。
 */
export function NumberField({
  label,
  hint,
  help,
  value,
  onCommit,
  inputMode = 'decimal',
  className,
}: {
  label: string
  hint?: string
  help?: string
  value: number
  onCommit: (value: number) => void
  inputMode?: 'decimal' | 'numeric'
  className?: string
}) {
  const [text, setText] = useState(() => String(value))

  // 外から値が変わったときだけ追従する(入力途中の「1.」は書き換えない)。
  useEffect(() => {
    setText((current) => (Number(current) === value ? current : String(value)))
  }, [value])

  return (
    <Field label={label} hint={hint} help={help} className={className}>
      <input
        className={inputClass}
        value={text}
        inputMode={inputMode}
        onChange={(event) => {
          const raw = event.target.value
          setText(raw)
          const parsed = Number(raw)
          if (raw.trim() !== '' && Number.isFinite(parsed)) onCommit(parsed)
        }}
        onBlur={() => setText(String(value))}
      />
    </Field>
  )
}
