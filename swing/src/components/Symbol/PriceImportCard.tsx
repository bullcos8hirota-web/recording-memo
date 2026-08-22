import { useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { parsePriceCsv, readCsvFile } from '../../lib/market/csv'
import { readClipboard } from '../../lib/clipboard'
import { price, shortDate } from '../../lib/format'
import { buttonClass, Card, inputClass, subtleButtonClass } from '../ui/Primitives'
import type { Stock } from '../../lib/market/types'

/**
 * 銘柄画面の中に置く取り込み口。どの銘柄に入るのかが目の前にあるので、
 * 別の銘柄のデータを入れてしまう事故が起きにくい。
 */
export function PriceImportCard({ stock, barCount }: { stock: Stock; barCount: number }) {
  const importBars = useAppStore((s) => s.importBars)
  const [open, setOpen] = useState(barCount === 0)
  const [text, setText] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const parsed = text.trim() === '' ? null : parsePriceCsv(text)
  const bars = parsed?.rows ?? []
  const last = bars[bars.length - 1] ?? null

  const paste = async () => {
    const clip = await readClipboard()
    setError(clip.ok ? null : clip.reason)
    setMessage(null)
    if (clip.ok) setText(clip.text)
  }

  const run = async () => {
    const total = await importBars(stock.code, bars)
    setMessage(
      `${bars.length}本を取り込みました(${shortDate(bars[0].date)}〜${shortDate(
        bars[bars.length - 1].date,
      )})。保存済みは合計${total}本。`,
    )
    setText('')
    setError(null)
  }

  if (!open) {
    return (
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            株価データ {barCount}本
          </p>
          <button type="button" className={subtleButtonClass} onClick={() => setOpen(true)}>
            株価を貼り付ける
          </button>
        </div>
        {message && <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{message}</p>}
      </Card>
    )
  }

  return (
    <Card
      title="株価を取り込む"
      description={`${stock.code} ${stock.name} に入ります。時系列の表をそのまま貼り付けてください。`}
    >
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} onClick={() => void paste()}>
          クリップボードから貼り付け
        </button>
        <label className={`${subtleButtonClass} cursor-pointer`}>
          CSVファイル
          <input
            type="file"
            accept=".csv,.txt,text/csv"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (!file) return
              setText(await readCsvFile(file))
              event.target.value = ''
            }}
          />
        </label>
      </div>

      <textarea
        className={`${inputClass} mt-3 min-h-32 font-mono text-sm`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'26/8/21\t1,410\t1,430\t1,405\t1,425'}
      />

      {last && (
        <div className="mt-3 rounded-xl bg-neutral-50 px-3 py-2 text-sm dark:bg-neutral-800/60">
          <p className="font-medium">
            {bars.length}本 / {shortDate(bars[0].date)}〜{shortDate(last.date)}
          </p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            出来高が読めた行 {bars.filter((bar) => bar.volume > 0).length}/{bars.length}
            {parsed && parsed.skipped > 0 && ` / 読めなかった行 ${parsed.skipped}`}
            <br />
            最新 {shortDate(last.date)}: 始値{price(last.open)} 高値{price(last.high)} 安値
            {price(last.low)} 終値{price(last.close)} 出来高
            {last.volume > 0 ? last.volume.toLocaleString('ja-JP') : '—'}
          </p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            この終値が{stock.name}のものか、元の画面と見比べてください。
          </p>
        </div>
      )}

      {parsed && bars.length === 0 && parsed.error && (
        <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{parsed.error}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={buttonClass}
          disabled={bars.length === 0}
          onClick={() => void run()}
        >
          {stock.code}に取り込む
        </button>
        {barCount > 0 && (
          <button type="button" className={subtleButtonClass} onClick={() => setOpen(false)}>
            閉じる
          </button>
        )}
        {message && <span className="text-sm text-neutral-600 dark:text-neutral-300">{message}</span>}
        {error && <span className="text-sm text-rose-600 dark:text-rose-400">{error}</span>}
      </div>
    </Card>
  )
}
