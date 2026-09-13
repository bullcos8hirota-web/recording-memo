import { useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import {
  daysAgo,
  fetchDailyBars,
  fetchEarningsDate,
  JQuantsError,
} from '../../lib/market/jquants'
import { updateSeries, type UpdateResult } from '../../lib/market/updateSeries'
import { today } from '../../lib/format'
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
  const updateStock = useAppStore((s) => s.updateStock)
  const [progress, setProgress] = useState<{
    done: number
    total: number
    label: string
  } | null>(null)
  const [results, setResults] = useState<UpdateResult[] | null>(null)
  const [earnings, setEarnings] = useState<{
    tried: number
    filled: number
    unpublished: number
    failure: string | null
  } | null>(null)

  if (!apiKey) return null

  const run = async () => {
    setResults(null)
    setEarnings(null)
    setProgress({ done: 0, total: stocks.length, label: '株価を更新中' })
    const from = daysAgo(HISTORY_DAYS)
    const to = daysAgo(0)
    const done = await updateSeries({
      targets: stocks.map((stock) => ({ code: stock.code, name: stock.name })),
      fetchBars: (code) => fetchDailyBars({ apiKey, code, from, to }),
      save: (code, bars) => replaceBars(code, bars),
      onProgress: (count, total) =>
        setProgress({ done: count, total, label: '株価を更新中' }),
    })
    setResults(done)

    // 決算発表日は、無いものと過ぎたものだけ取りに行く。一度入れば次の決算まで変わらない。
    const now = today()
    const stale = stocks.filter((stock) => !stock.earningsDate || stock.earningsDate < now)
    let filled = 0
    let unpublished = 0
    let failure: string | null = null
    for (const [index, stock] of stale.entries()) {
      setProgress({ done: index + 1, total: stale.length, label: '決算発表日を調べています' })
      try {
        const date = await fetchEarningsDate({ apiKey, code: stock.code, today: now })
        if (date) {
          await updateStock(stock.code, { earningsDate: date })
          filled += 1
        } else {
          // データは返ったが、先の予定がまだ公表されていない。
          unpublished += 1
        }
      } catch (error) {
        // 握りつぶすと「入らない理由」が分からなくなる。1件目の理由を残して打ち切る。
        failure = error instanceof Error ? error.message : String(error)
        if (error instanceof JQuantsError && (error.kind === 'rate' || error.kind === 'auth')) break
      }
    }
    setEarnings(stale.length > 0 ? { filled, unpublished, failure, tried: stale.length } : null)

    setProgress(null)
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
        {progress ? `${progress.label} ${progress.done}/${progress.total}` : '全銘柄を更新'}
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
          {earnings && (
            <p className="mt-1 text-slate-600 dark:text-slate-300">
              決算発表日：{earnings.filled}銘柄に入りました。
              {earnings.unpublished > 0 &&
                `${earnings.unpublished}銘柄は次回の予定がまだ公表されていません。`}
              {earnings.failure && `取得に失敗：${earnings.failure}`}
            </p>
          )}
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
