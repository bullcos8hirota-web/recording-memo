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
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={term.term}
            className="relative max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-white pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-xl dark:bg-slate-800 sm:max-w-lg sm:rounded-3xl sm:pb-6"
          >
            <div className="sticky top-0 flex items-center gap-2 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-800/95">
              {history.length > 1 && (
                <button
                  type="button"
                  onClick={back}
                  className="text-sm text-slate-600 transition hover:text-slate-900 dark:hover:text-slate-100"
                >
                  ← 戻る
                </button>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  {CATEGORY_LABEL[term.category]}
                </p>
                <h2 className="truncate text-base font-semibold">
                  {term.term}
                  {term.reading && (
                    <span className="ml-2 text-xs font-normal text-slate-600 dark:text-slate-300">
                      {term.reading}
                    </span>
                  )}
                </h2>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="閉じる"
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 px-4 py-4">
              <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium dark:bg-slate-700">
                {term.short}
              </p>
              {term.body.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 16)}
                  className="text-sm leading-relaxed text-slate-700 dark:text-slate-200"
                >
                  {paragraph}
                </p>
              ))}

              {term.inApp && (
                <div className="rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-600">
                  <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    このアプリでは
                  </p>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{term.inApp}</p>
                </div>
              )}

              {term.related && term.related.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
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
                          className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium transition hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-700"
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
