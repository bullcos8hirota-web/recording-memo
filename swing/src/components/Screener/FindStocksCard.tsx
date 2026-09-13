import { useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { daysAgo, fetchDailyBars, fetchMarketDay } from '../../lib/market/jquants'
import { JQuantsError } from '../../lib/market/jquants'
import { screenMarket, shortCode } from '../../lib/plan/screener'
import { analyze, VERDICT_LABEL, type Verdict } from '../../lib/market/signals'
import { universeFor } from '../../lib/money/universe'
import { count, percent, price } from '../../lib/format'
import type { Bar } from '../../lib/market/types'
import { Badge, Card, buttonClass, subtleButtonClass } from '../ui/Primitives'

/** 履歴まで調べる銘柄の数。多いほど時間がかかる。 */
const DEEP_LIMIT = 40
/** 指標を出すのに要る期間。 */
const HISTORY_DAYS = 400
/** 休場日にあたったとき、何日さかのぼるか。 */
const LOOKBACK_DAYS = 10

type Found = {
  code: string
  close: number
  turnover: number
  score: number
  verdict: Verdict
  atrRate: number | null
  bars: Bar[]
}

/**
 * 市場全体から、この資金で扱える銘柄を探す。
 *
 * 探す範囲は資金と許容損失から決まるので、選ぶのは好みではなく計算。
 * 1日分の全銘柄で数十件まで落としてから、その分だけ履歴を取る。
 */
export function FindStocksCard() {
  const settings = useAppStore((s) => s.settings)
  const stocks = useAppStore((s) => s.stocks)
  const apiKey = useAppStore((s) => s.settings.jquantsApiKey ?? '')
  const addStock = useAppStore((s) => s.addStock)
  const replaceBars = useAppStore((s) => s.replaceBars)

  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [found, setFound] = useState<Found[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [added, setAdded] = useState<string | null>(null)

  if (!apiKey) return null

  const universe = universeFor(settings)

  const run = async () => {
    setError(null)
    setFound(null)
    setAdded(null)
    setPicked(new Set())
    try {
      // 直近の営業日を探す。休場日は空で返ってくる。
      setProgress('市場全体を取得しています')
      let rows: Awaited<ReturnType<typeof fetchMarketDay>> = []
      for (let back = 0; back < LOOKBACK_DAYS && rows.length === 0; back += 1) {
        rows = await fetchMarketDay({ apiKey, date: daysAgo(back) })
      }
      if (rows.length === 0) {
        setError('直近10日分に取引のある日がありませんでした。')
        setProgress(null)
        return
      }

      const screened = screenMarket(rows, {
        settings,
        exclude: stocks.map((stock) => stock.code),
        limit: DEEP_LIMIT,
      })
      if (screened.candidates.length === 0) {
        setError(
          `${screened.counts.all}銘柄を調べましたが、株価${price(universe.priceCap)}円以下・` +
            '売買代金の条件を満たすものがありませんでした。',
        )
        setProgress(null)
        return
      }

      const results: Found[] = []
      const from = daysAgo(HISTORY_DAYS)
      const to = daysAgo(0)
      for (const [index, candidate] of screened.candidates.entries()) {
        setProgress(`値動きを調べています ${index + 1}/${screened.candidates.length}`)
        try {
          const bars = await fetchDailyBars({ apiKey, code: candidate.code, from, to })
          if (bars.length < 80) continue
          const { score, verdict, snapshot } = analyze(bars)
          results.push({
            code: shortCode(candidate.code),
            close: candidate.close,
            turnover: candidate.turnover,
            score,
            verdict,
            atrRate: snapshot.atrRate,
            bars,
          })
        } catch (caught) {
          // 1銘柄取れなくても残りは続ける。ただし上限や認証は、続けても同じ結果になる。
          if (caught instanceof JQuantsError && (caught.kind === 'rate' || caught.kind === 'auth')) {
            setError(`${caught.message}（${results.length}銘柄まで調べました）`)
            break
          }
        }
      }
      results.sort((a, b) => b.score - a.score)
      setFound(results)
      setPicked(new Set(results.filter((item) => item.verdict !== 'avoid').map((item) => item.code)))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setProgress(null)
    }
  }

  const add = async () => {
    if (!found) return
    const targets = found.filter((item) => picked.has(item.code))
    for (const item of targets) {
      await addStock({ code: item.code, name: item.code, lot: settings.defaultLot })
      await replaceBars(item.code, item.bars)
    }
    setAdded(`${targets.length}銘柄を監視リストに追加しました。`)
    setFound(null)
  }

  return (
    <Card
      title="銘柄を探す"
      description={`市場全体から、この資金で買える銘柄を拾います（株価${price(universe.priceCap)}円以下 / 1日の値幅2.5%以上 / 売買代金${Math.round(universe.turnoverFloor / 100_000_000)}億円以上）`}
    >
      <button
        type="button"
        className={`${buttonClass} w-full`}
        onClick={() => void run()}
        disabled={progress !== null}
      >
        {progress ?? '市場から探す'}
      </button>
      {progress && (
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
          40銘柄ぶんの履歴を取るので、1分ほどかかります。
        </p>
      )}

      {error && <p className="mt-2 text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      {added && <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">{added}</p>}

      {found && found.length > 0 && (
        <div className="mt-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {found.length}銘柄が見つかりました。チェックしたものを追加します。
            銘柄名は追加後に「銘柄」タブで直せます。
          </p>
          <ul className="mt-2 divide-y divide-slate-200 dark:divide-slate-700">
            {found.map((item) => (
              <li key={item.code} className="py-2">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 size-5 shrink-0"
                    checked={picked.has(item.code)}
                    onChange={(event) => {
                      const next = new Set(picked)
                      if (event.target.checked) next.add(item.code)
                      else next.delete(item.code)
                      setPicked(next)
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-mono font-medium">{item.code}</span>
                      <span className="text-lg font-semibold tabular-nums">{item.score}</span>
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <Badge
                        tone={
                          item.verdict === 'ready'
                            ? 'bull'
                            : item.verdict === 'avoid'
                              ? 'bear'
                              : 'info'
                        }
                      >
                        {VERDICT_LABEL[item.verdict]}
                      </Badge>
                      <span className="tabular-nums">{price(item.close)}円</span>
                      <span className="tabular-nums">値幅 {percent(item.atrRate)}</span>
                      <span className="tabular-nums">
                        代金 {count(Math.round(item.turnover / 100_000_000))}億円
                      </span>
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={buttonClass} onClick={() => void add()}>
              選んだ{picked.size}銘柄を追加
            </button>
            <button type="button" className={subtleButtonClass} onClick={() => setFound(null)}>
              やめる
            </button>
          </div>
        </div>
      )}

      {found && found.length === 0 && (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          条件に合う銘柄が見つかりませんでした。
        </p>
      )}
    </Card>
  )
}
