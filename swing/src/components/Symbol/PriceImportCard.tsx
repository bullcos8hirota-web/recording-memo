import { useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { parsePriceCsv, readCsvFile } from '../../lib/market/csv'
import { suspiciousJumps } from '../../lib/market/importCheck'
import { readClipboard } from '../../lib/clipboard'
import { price, shortDate } from '../../lib/format'
import { buttonClass, Card, inputClass, subtleButtonClass } from '../ui/Primitives'
import type { Bar, Stock } from '../../lib/market/types'

/**
 * 未取り込みの銘柄で使う空配列。毎回新しい配列を返すと、
 * ストアの購読が「値が変わった」と見なして再描画が止まらなくなる。
 */
const NO_BARS: Bar[] = []

/**
 * 銘柄画面の中に置く取り込み口。どの銘柄に入るのかが目の前にあるので、
 * 別の銘柄のデータを入れてしまう事故が起きにくい。
 */
export function PriceImportCard({ stock, barCount }: { stock: Stock; barCount: number }) {
  const importBars = useAppStore((s) => s.importBars)
  const stored = useAppStore((s) => s.series[stock.code] ?? NO_BARS)
  const stocks = useAppStore((s) => s.stocks)
  const series = useAppStore((s) => s.series)
  const select = useAppStore((s) => s.select)
  const [open, setOpen] = useState(barCount === 0)
  const [text, setText] = useState('')
  // 分割の前後で株価が桁違いになるので、そこより前を捨てて取り込めるようにする。
  const [trimFrom, setTrimFrom] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const parsed = text.trim() === '' ? null : parsePriceCsv(text)
  const all = parsed?.rows ?? []
  const bars = trimFrom ? all.filter((bar) => bar.date >= trimFrom) : all
  const last = bars[bars.length - 1] ?? null
  const jumps = bars.length > 0 ? suspiciousJumps(stored, bars) : []
  // 分割はいちばん大きな段差として出る。捨てる境目はそこに合わせる。
  const biggest = jumps.reduce<(typeof jumps)[number] | null>(
    (max, jump) => (max === null || Math.abs(jump.changeRate) > Math.abs(max.changeRate) ? jump : max),
    null,
  )

  const paste = async () => {
    const clip = await readClipboard()
    setError(clip.ok ? null : clip.reason)
    setMessage(null)
    setTrimFrom(null)
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
    setTrimFrom(null)
    setError(null)
  }

  // 銘柄が増えると、次にどれを貼るかを探すこと自体が手間になる。
  // まだ今週分が入っていない銘柄へ、そのまま送る。
  const latestDate = (code: string): string => series[code]?.at(-1)?.date ?? ''
  const freshest = stocks.reduce((max, item) => {
    const date = latestDate(item.code)
    return date > max ? date : max
  }, '')
  const next = stocks.find((item) => item.code !== stock.code && latestDate(item.code) < freshest)

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
        onChange={(e) => {
          setText(e.target.value)
          setTrimFrom(null)
        }}
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

      {jumps.length > 0 && (
        <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-medium">
            値動きが大きすぎる日があります（
            {jumps
              .slice(0, 3)
              .map((jump) => `${shortDate(jump.date)} ${jump.changeRate > 0 ? '+' : ''}${jump.changeRate.toFixed(1)}%`)
              .join(' / ')}
            ）
          </p>
          <p className="mt-1 text-xs">
            {stock.name}のデータで合っていますか。よくある原因は2つです。
            別の銘柄の時系列を貼った（価格帯が近いと見た目では気づけません）か、
            株式分割です（分割の前後で株価が桁違いになります）。
            決算などで実際に動いた日なら、そのまま取り込んで構いません。
          </p>
          <button
            type="button"
            className={`${subtleButtonClass} mt-2`}
            onClick={() => biggest && setTrimFrom(biggest.date)}
          >
            {biggest && shortDate(biggest.date)}より前を捨てる
          </button>
        </div>
      )}

      {trimFrom && (
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          {shortDate(trimFrom)}より前の{all.length - bars.length}本を除いています。
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => setTrimFrom(null)}
          >
            元に戻す
          </button>
        </p>
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
        {message && next && (
          <button type="button" className={subtleButtonClass} onClick={() => select(next.code)}>
            次の銘柄へ（{next.name}）
          </button>
        )}
        {message && <span className="text-sm text-neutral-600 dark:text-neutral-300">{message}</span>}
        {error && <span className="text-sm text-rose-600 dark:text-rose-400">{error}</span>}
      </div>
    </Card>
  )
}
