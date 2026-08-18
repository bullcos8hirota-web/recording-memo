import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { CATEGORY_LABEL, findTerm } from '../../lib/learn/glossary'
import { GlossaryContext } from './glossaryContext'

/**
 * 用語解説シートをアプリ全体で共有する。どの画面からでも openTerm(id) で開ける。
 * 関連語をたどれるように、表示した用語を履歴として持つ。
 */
export function GlossaryProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<string[]>([])
  const current = history[history.length - 1] ?? null
  const term = current ? findTerm(current) : null

  const openTerm = useCallback((id: string) => {
    setHistory((prev) => (prev[prev.length - 1] === id ? prev : [...prev, id]))
  }, [])

  const close = useCallback(() => setHistory([]), [])
  const back = useCallback(() => setHistory((prev) => prev.slice(0, -1)), [])

  // シートを開いている間は背面をスクロールさせない。
  useEffect(() => {
    if (!term) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [term, close])

  const value = useMemo(() => ({ openTerm }), [openTerm])

  return (
    <GlossaryContext.Provider value={value}>
      {children}
      {term && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="閉じる"
            onClick={close}
            className="absolute inset-0 bg-neutral-900/40 backdrop-blur-[2px]"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={term.term}
            className="relative max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-white pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-xl dark:bg-neutral-900 sm:max-w-lg sm:rounded-3xl sm:pb-6"
          >
            <div className="sticky top-0 flex items-center gap-2 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95">
              {history.length > 1 && (
                <button
                  type="button"
                  onClick={back}
                  className="text-sm text-neutral-500 transition hover:text-neutral-900 dark:hover:text-neutral-100"
                >
                  ← 戻る
                </button>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {CATEGORY_LABEL[term.category]}
                </p>
                <h2 className="truncate text-base font-semibold">
                  {term.term}
                  {term.reading && (
                    <span className="ml-2 text-xs font-normal text-neutral-500 dark:text-neutral-400">
                      {term.reading}
                    </span>
                  )}
                </h2>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="閉じる"
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 px-4 py-4">
              <p className="rounded-xl bg-neutral-100 px-3 py-2 text-sm font-medium dark:bg-neutral-800">
                {term.short}
              </p>
              {term.body.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 16)}
                  className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300"
                >
                  {paragraph}
                </p>
              ))}

              {term.inApp && (
                <div className="rounded-xl border border-neutral-200 px-3 py-2 dark:border-neutral-700">
                  <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                    このアプリでは
                  </p>
                  <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{term.inApp}</p>
                </div>
              )}

              {term.related && term.related.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                    あわせて読む
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {term.related.map((id) => {
                      const related = findTerm(id)
                      if (!related) return null
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => openTerm(id)}
                          className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-medium transition hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                        >
                          {related.term}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </GlossaryContext.Provider>
  )
}
