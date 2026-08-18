import type { ReactNode } from 'react'
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
    <section className="rounded-2xl border border-neutral-200 bg-white p-3.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-5">
      {(title || actions) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {description && (
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                {description}
              </p>
            )}
          </div>
          {actions}
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
    <div className="rounded-xl bg-neutral-50 px-3 py-2 dark:bg-neutral-800/60">
      <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
        <span>{label}</span>
        {help && <HelpButton term={help} label={label} />}
      </div>
      <div className={`mt-0.5 text-base font-semibold tabular-nums ${tone ?? ''}`}>
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">{hint}</div>
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
      <span className="inline-flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
        {label}
        {help && <HelpButton term={help} label={label} />}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">{hint}</span>
      )}
    </label>
  )
}

// text-base(16px)にしておかないと、iOS Safariが入力欄にフォーカスした瞬間に拡大する。
export const inputClass =
  'mt-1 w-full min-h-11 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base tabular-nums outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-neutral-300 sm:text-sm'

export const buttonClass =
  'inline-flex min-h-11 items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300'

export const subtleButtonClass =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium transition hover:bg-neutral-100 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800'

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
    neutral: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
  } as const
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-10 text-center dark:border-neutral-700">
      <p className="font-medium">{title}</p>
      {children && (
        <div className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{children}</div>
      )}
    </div>
  )
}
