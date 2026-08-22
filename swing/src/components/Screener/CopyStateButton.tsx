import { useRef, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { buildWatchlistText } from '../../lib/export/watchlistText'
import { inputClass, subtleButtonClass } from '../ui/Primitives'

/**
 * 監視リストの状態を文章にしてコピーする。
 * データは端末内にしか無いので、誰かに相談したいときの持ち出し口になる。
 * クリップボードが使えない環境では、選択してコピーできるように本文を表示する。
 */
export function CopyStateButton() {
  const stocks = useAppStore((s) => s.stocks)
  const series = useAppStore((s) => s.series)
  const trades = useAppStore((s) => s.trades)
  const settings = useAppStore((s) => s.settings)
  const [text, setText] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  const run = async () => {
    const body = buildWatchlistText({ stocks, series, trades, settings })
    try {
      await navigator.clipboard.writeText(body)
      setCopied(true)
      setText(null)
    } catch {
      // 許可されない環境では、手で選んでコピーしてもらう
      setCopied(false)
      setText(body)
      requestAnimationFrame(() => areaRef.current?.select())
    }
  }

  return (
    <div>
      <button type="button" className={subtleButtonClass} onClick={() => void run()}>
        状態をコピー
      </button>
      {copied && (
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
          コピーしました。そのまま貼り付けて相談できます。
        </p>
      )}
      {text && (
        <div className="mt-2">
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            自動コピーができませんでした。下の文章を選んでコピーしてください。
          </p>
          <textarea
            ref={areaRef}
            readOnly
            value={text}
            className={`${inputClass} min-h-48 font-mono text-xs`}
          />
        </div>
      )}
    </div>
  )
}
