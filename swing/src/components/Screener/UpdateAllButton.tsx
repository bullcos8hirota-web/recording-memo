import { useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { daysAgo, fetchDailyBars } from '../../lib/market/jquants'
import { updateSeries, type UpdateResult } from '../../lib/market/updateSeries'
import { subtleButtonClass } from '../ui/Primitives'

/** 初回に取りに行く期間。指標は80本あれば足りるので、1年分あれば十分。 */
const HISTORY_DAYS = 400

/**
 * 監視中の銘柄の日足を、J-Quantsからまとめて取り込む。
 * 金曜の引け後に1回押すだけで済むようにするためのボタン。
 */
export function UpdateAllButton({ onDone }: { onDone?: () => void }) {
  const stocks = useAppStore((s) => s.stocks)
  const apiKey = useAppStore((s) => s.settings.jquantsApiKey ?? '')
  const replaceBars = useAppStore((s) => s.replaceBars)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [results, setResults] = useState<UpdateResult[] | null>(null)

  if (!apiKey) return null

  const run = async () => {
    setResults(null)
    setProgress({ done: 0, total: stocks.length })
    const from = daysAgo(HISTORY_DAYS)
    const to = daysAgo(0)
    const done = await updateSeries({
      targets: stocks.map((stock) => ({ code: stock.code, name: stock.name })),
      fetchBars: (code) => fetchDailyBars({ apiKey, code, from, to }),
      save: (code, bars) => replaceBars(code, bars),
      onProgress: (count, total) => setProgress({ done: count, total }),
    })
    setProgress(null)
    setResults(done)
    onDone?.()
  }

  const failed = results?.filter((item) => item.error !== null) ?? []
  const okCount = (results?.length ?? 0) - failed.length

  return (
    <div className="text-right">
      <button
        type="button"
        className={subtleButtonClass}
        onClick={() => void run()}
        disabled={progress !== null || stocks.length === 0}
      >
        {progress ? `更新中 ${progress.done}/${progress.total}` : '全銘柄を更新'}
      </button>

      {results && (
        <div className="mt-2 text-left text-xs">
          <p className="text-slate-700 dark:text-slate-200">
            {okCount}銘柄を更新しました。
            {failed.length > 0 && `${failed.length}銘柄は取れませんでした。`}
          </p>
          {failed.map((item) => (
            <p key={item.code} className="mt-1 text-rose-700 dark:text-rose-300">
              {item.code} {item.name}: {item.skipped ? '未取得(手前で止まりました)' : item.error}
            </p>
          ))}
          {failed.length > 0 && (
            <p className="mt-1 text-slate-600 dark:text-slate-300">
              取れなかった銘柄は、銘柄タブの「株価を貼り付ける」で今までどおり取り込めます。
            </p>
          )}
        </div>
      )}
    </div>
  )
}
