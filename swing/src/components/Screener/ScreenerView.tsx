import { useMemo, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { analyze, MIN_BARS, VERDICT_LABEL, type Analysis } from '../../lib/market/signals'
import type { Stock } from '../../lib/market/types'
import { percent, price, shortDate, toneClass } from '../../lib/format'
import { useIsPhone } from '../../lib/useMediaQuery'
import {
  Badge,
  buttonClass,
  Card,
  EmptyState,
  inputClass,
  subtleButtonClass,
} from '../ui/Primitives'

export type Row = { stock: Stock; analysis: Analysis | null; bars: number; lastDate: string | null }

const FILTERS = [
  { id: 'all', label: 'すべて' },
  { id: 'ready', label: '条件が揃っている' },
  { id: 'watch', label: '監視したい以上' },
  { id: 'holding', label: '建玉あり' },
] as const

type FilterId = (typeof FILTERS)[number]['id']

export function ScreenerView({ onOpen }: { onOpen: (code: string) => void }) {
  const stocks = useAppStore((s) => s.stocks)
  const series = useAppStore((s) => s.series)
  const trades = useAppStore((s) => s.trades)
  const loadSample = useAppStore((s) => s.loadSample)
  const [filter, setFilter] = useState<FilterId>('all')

  const holdingCodes = useMemo(
    () => new Set(trades.filter((t) => t.exitDate === null).map((t) => t.code)),
    [trades],
  )

  const rows = useMemo<Row[]>(() => {
    return stocks
      .map((stock) => {
        const bars = series[stock.code] ?? []
        return {
          stock,
          analysis: bars.length >= 30 ? analyze(bars) : null,
          bars: bars.length,
          lastDate: bars.length ? bars[bars.length - 1].date : null,
        }
      })
      .sort((a, b) => (b.analysis?.score ?? -1) - (a.analysis?.score ?? -1))
  }, [stocks, series])

  const visible = rows.filter((row) => {
    if (filter === 'ready') return row.analysis?.verdict === 'ready'
    if (filter === 'watch') return row.analysis?.verdict === 'ready' || row.analysis?.verdict === 'watch'
    if (filter === 'holding') return holdingCodes.has(row.stock.code)
    return true
  })

  return (
    <div className="space-y-4">
      <AddStockForm />

      {stocks.length === 0 ? (
        <EmptyState title="まだ銘柄が登録されていません">
          <p>上のフォームで銘柄を追加し、「取込」タブで株価CSVを読み込んでください。</p>
          <button type="button" className={`${subtleButtonClass} mt-3`} onClick={() => void loadSample()}>
            サンプルデータで試す
          </button>
        </EmptyState>
      ) : (
        <Card
          title="ウォッチリスト"
          description="スイング目線のスコア順。スコアはチャートの状態を点数化したもので、売買の指示ではありません。"
        >
          <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  filter === item.id
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
              条件に合う銘柄はありません。
            </p>
          ) : (
            <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {visible.map((row) => (
                <ScreenerRow
                  key={row.stock.code}
                  row={row}
                  holding={holdingCodes.has(row.stock.code)}
                  onOpen={onOpen}
                />
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  )
}

function ScreenerRow({
  row,
  holding,
  onOpen,
}: {
  row: Row
  holding: boolean
  onOpen: (code: string) => void
}) {
  const isPhone = useIsPhone()
  const { stock, analysis } = row
  const snapshot = analysis?.snapshot
  // 画面が狭いときはバッジを減らして、1行に収まるようにする。
  const positives = analysis?.signals.filter((s) => s.tone === 'bull').slice(0, isPhone ? 1 : 2) ?? []
  const negatives = analysis?.signals.filter((s) => s.tone === 'bear').slice(0, 1) ?? []

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(stock.code)}
        className="w-full py-3.5 text-left transition active:bg-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 dark:active:bg-neutral-800"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="shrink-0 font-mono text-sm text-neutral-500 dark:text-neutral-400">
                {stock.code}
              </span>
              <span className="truncate font-medium">{stock.name}</span>
              {holding && <Badge tone="info">建玉あり</Badge>}
              {stock.demo && (
                <span className="hidden sm:inline-flex">
                  <Badge>サンプル</Badge>
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="tabular-nums">{price(snapshot?.close)}円</span>
              <span className={`tabular-nums ${toneClass(snapshot?.changeRate)}`}>
                {percent(snapshot?.changeRate)}
              </span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {row.bars}本 / {shortDate(row.lastDate)}まで
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {positives.map((signal) => (
                <Badge key={signal.id} tone="bull">
                  {signal.label}
                </Badge>
              ))}
              {negatives.map((signal) => (
                <Badge key={signal.id} tone="bear">
                  {signal.label}
                </Badge>
              ))}
              {row.bars > 0 && row.bars < MIN_BARS && <Badge>データ不足</Badge>}
              {row.bars === 0 && <Badge>価格データなし</Badge>}
            </div>
          </div>
          <ScoreDial analysis={analysis} />
        </div>
      </button>
    </li>
  )
}

function ScoreDial({ analysis }: { analysis: Analysis | null }) {
  if (!analysis) {
    return <span className="text-xs text-neutral-400">—</span>
  }
  const color =
    analysis.verdict === 'ready'
      ? 'bg-rose-500'
      : analysis.verdict === 'watch'
        ? 'bg-amber-500'
        : analysis.verdict === 'avoid'
          ? 'bg-sky-500'
          : 'bg-neutral-400'
  return (
    <div className="w-24 shrink-0 text-right">
      <div className="text-lg font-semibold tabular-nums">{analysis.score}</div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${analysis.score}%` }} />
      </div>
      <div className="mt-1 whitespace-nowrap text-[10px] text-neutral-500 dark:text-neutral-400 sm:text-[11px]">
        {VERDICT_LABEL[analysis.verdict]}
      </div>
    </div>
  )
}

function AddStockForm() {
  const addStock = useAppStore((s) => s.addStock)
  const defaultLot = useAppStore((s) => s.settings.defaultLot)
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [lot, setLot] = useState(String(defaultLot))

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!code.trim()) return
    void addStock({ code, name, lot: Number(lot) || defaultLot })
    setCode('')
    setName('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        ＋ 銘柄を追加
      </button>
    )
  }

  return (
    <Card
      title="銘柄を追加"
      description="証券コードと銘柄名を登録します。価格データは「取込」タブで入れます。"
      actions={
        <button type="button" className={subtleButtonClass} onClick={() => setOpen(false)}>
          閉じる
        </button>
      }
    >
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <label className="min-w-32 flex-1 text-sm sm:flex-none">
          <span className="text-neutral-600 dark:text-neutral-300">コード</span>
          <input
            className={`${inputClass} w-full sm:w-28`}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="7203"
            inputMode="text"
          />
        </label>
        <label className="min-w-40 flex-1 text-sm">
          <span className="text-neutral-600 dark:text-neutral-300">銘柄名</span>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="銘柄名"
          />
        </label>
        <label className="min-w-28 flex-1 text-sm sm:flex-none">
          <span className="text-neutral-600 dark:text-neutral-300">売買単位</span>
          <input
            className={`${inputClass} w-full sm:w-24`}
            value={lot}
            onChange={(e) => setLot(e.target.value)}
            inputMode="numeric"
          />
        </label>
        <button type="submit" className={`${buttonClass} w-full sm:w-auto`}>
          追加
        </button>
      </form>
    </Card>
  )
}
