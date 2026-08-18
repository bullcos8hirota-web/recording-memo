import { findTerm } from '../../lib/learn/glossary'
import { useGlossary } from './glossaryContext'

/**
 * 用語の横に置く「?」ボタン。押すと解説シートが開く。
 * 知らない言葉が出てきたその場で調べられるようにするのが目的。
 */
export function HelpButton({ term, label }: { term: string; label?: string }) {
  const { openTerm } = useGlossary()
  const entry = findTerm(term)
  if (!entry) return null

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        openTerm(term)
      }}
      aria-label={`${label ?? entry.term}の意味を見る`}
      className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-[11px] font-semibold leading-none text-neutral-500 transition hover:bg-neutral-100 active:opacity-70 dark:border-neutral-600 dark:text-neutral-400 dark:hover:bg-neutral-800"
    >
      ?
    </button>
  )
}

/** 文中に置く、下線付きの用語リンク。 */
export function TermLink({ term, children }: { term: string; children?: React.ReactNode }) {
  const { openTerm } = useGlossary()
  const entry = findTerm(term)
  if (!entry) return <>{children}</>

  return (
    <button
      type="button"
      onClick={() => openTerm(term)}
      className="underline decoration-dotted underline-offset-2 transition hover:text-neutral-900 dark:hover:text-neutral-100"
    >
      {children ?? entry.term}
    </button>
  )
}
