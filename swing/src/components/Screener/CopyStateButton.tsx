import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { buildWatchlistText } from '../../lib/export/watchlistText'
import { buttonClass, inputClass, subtleButtonClass } from '../ui/Primitives'

/**
 * 監視リストの状態を文章にしてコピーする。
 * データは端末内にしか無いので、誰かに相談したいときの持ち出し口になる。
 * クリップボードが使えない環境では、選んでコピーできるように本文を出す。
 */
export function CopyStateButton() {
  const stocks = useAppStore((s) => s.stocks)
  const series = useAppStore((s) => s.series)
  const trades = useAppStore((s) => s.trades)
  const settings = useAppStore((s) => s.settings)
  const [text, setText] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2500)
    return () => clearTimeout(timer)
  }, [copied])

  const run = async () => {
    const body = buildWatchlistText({ stocks, series, trades, settings })
    try {
      await navigator.clipboard.writeText(body)
      setCopied(true)
      setText(null)
    } catch {
      setCopied(false)
      setText(body)
      requestAnimationFrame(() => areaRef.current?.select())
    }
  }

  return (
    <>
      <button
        type="button"
        className={`${subtleButtonClass} whitespace-nowrap px-3`}
        onClick={() => void run()}
      >
        {copied ? 'コピーしました' : '状態をコピー'}
      </button>

      {/* クリップボードが使えないときだけ、下から本文を出して手でコピーしてもらう */}
      {text && (
        <div className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 rounded-2xl border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            自動コピーができませんでした。下の文章を選んでコピーしてください。
          </p>
          <textarea
            ref={areaRef}
            readOnly
            value={text}
            className={`${inputClass} mt-2 min-h-48 font-mono text-xs`}
          />
          <button type="button" className={`${buttonClass} mt-2`} onClick={() => setText(null)}>
            閉じる
          </button>
        </div>
      )}
    </>
  )
}
