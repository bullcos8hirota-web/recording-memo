import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from './stores/appStore'
import { ScreenerView } from './components/Screener/ScreenerView'
import { SymbolDetail } from './components/Symbol/SymbolDetail'
import { PositionsView } from './components/Positions/PositionsView'
import { JournalView } from './components/Journal/JournalView'
import { ImportView } from './components/Import/ImportView'
import { SettingsView } from './components/Settings/SettingsView'
import { isClosed } from './lib/money/trade'
import { yen } from './lib/format'

const TABS = [
  { id: 'screener', label: '監視' },
  { id: 'symbol', label: '銘柄' },
  { id: 'positions', label: '建玉' },
  { id: 'journal', label: '記録' },
  { id: 'import', label: '取込' },
  { id: 'settings', label: '設定' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function App() {
  const ready = useAppStore((s) => s.ready)
  const load = useAppStore((s) => s.load)
  const select = useAppStore((s) => s.select)
  const settings = useAppStore((s) => s.settings)
  const trades = useAppStore((s) => s.trades)
  const series = useAppStore((s) => s.series)
  const [tab, setTab] = useState<TabId>('screener')

  useEffect(() => {
    void load()
  }, [load])

  const openCount = trades.filter((t) => !isClosed(t)).length

  /** 損切り・利確ラインに触れている建玉。開いた瞬間に気づけるよう上部に出す。 */
  const alerts = useMemo(() => {
    return trades
      .filter((trade) => !isClosed(trade))
      .flatMap((trade) => {
        const bars = series[trade.code] ?? []
        const last = bars[bars.length - 1]
        if (!last) return []
        if (trade.stopPrice !== null && last.close <= trade.stopPrice) {
          return [`${trade.name} が損切りライン(${trade.stopPrice}円)に到達しています`]
        }
        if (trade.targetPrice !== null && last.close >= trade.targetPrice) {
          return [`${trade.name} が利確ライン(${trade.targetPrice}円)に到達しています`]
        }
        return []
      })
  }, [trades, series])

  const openDetail = (code: string) => {
    select(code)
    setTab('symbol')
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95">
        <div className="mx-auto max-w-4xl px-4 pt-3 sm:px-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-lg font-semibold">スイングトレード支援</h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              資金 {yen(settings.capital)} / 1トレードの許容損失{' '}
              {yen((settings.capital * settings.riskPercent) / 100)}({settings.riskPercent}%)
              {openCount > 0 && ` / 建玉 ${openCount}件`}
            </p>
          </div>
          <nav className="-mb-px mt-2 flex gap-1 overflow-x-auto">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition ${
                  tab === item.id
                    ? 'border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100'
                    : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
                }`}
              >
                {item.label}
                {item.id === 'positions' && openCount > 0 && (
                  <span className="ml-1 rounded-full bg-neutral-200 px-1.5 py-0.5 text-[10px] tabular-nums dark:bg-neutral-700">
                    {openCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-4 pb-[calc(3rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6">
        {alerts.length > 0 && (
          <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <p className="font-medium">確認したい建玉があります</p>
            <ul className="mt-1 list-disc pl-5">
              {alerts.map((alert) => (
                <li key={alert}>{alert}</li>
              ))}
            </ul>
          </div>
        )}

        {!ready ? (
          <p className="py-16 text-center text-sm text-neutral-500 dark:text-neutral-400">読み込み中…</p>
        ) : (
          <>
            {tab === 'screener' && <ScreenerView onOpen={openDetail} />}
            {tab === 'symbol' && <SymbolDetail onGoImport={() => setTab('import')} />}
            {tab === 'positions' && <PositionsView />}
            {tab === 'journal' && <JournalView />}
            {tab === 'import' && <ImportView />}
            {tab === 'settings' && <SettingsView />}
          </>
        )}

        <p className="mt-8 text-center text-xs text-neutral-400 dark:text-neutral-600">
          判断材料を整理するためのツールです。売買を推奨するものではありません。
        </p>
      </main>
    </div>
  )
}
