import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from './stores/appStore'
import { ScreenerView } from './components/Screener/ScreenerView'
import { SymbolDetail } from './components/Symbol/SymbolDetail'
import { PositionsView } from './components/Positions/PositionsView'
import { JournalView } from './components/Journal/JournalView'
import { ImportView } from './components/Import/ImportView'
import { SettingsView } from './components/Settings/SettingsView'
import { BottomTabBar, TopTabBar } from './components/Layout/TabBar'
import { TABS, type TabId } from './components/Layout/tabs'
import { isClosed } from './lib/money/trade'
import { yen } from './lib/format'

export default function App() {
  const ready = useAppStore((s) => s.ready)
  const load = useAppStore((s) => s.load)
  const select = useAppStore((s) => s.select)
  const settings = useAppStore((s) => s.settings)
  const trades = useAppStore((s) => s.trades)
  const series = useAppStore((s) => s.series)
  const storageError = useAppStore((s) => s.storageError)
  const [tab, setTab] = useState<TabId>('screener')

  useEffect(() => {
    void load()
  }, [load])

  // タブを切り替えたら先頭から読ませる(スマホでは前の位置に残ると迷子になる)。
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [tab])

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
          return [`${trade.name} が損切りライン(${trade.stopPrice}円)に到達`]
        }
        if (trade.targetPrice !== null && last.close >= trade.targetPrice) {
          return [`${trade.name} が利確ライン(${trade.targetPrice}円)に到達`]
        }
        return []
      })
  }, [trades, series])

  const openDetail = (code: string) => {
    select(code)
    setTab('symbol')
  }

  const title = TABS.find((item) => item.id === tab)?.label ?? ''
  const badges = { positions: openCount }

  return (
    <div className="min-h-[100dvh] bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95">
        <div className="mx-auto max-w-4xl px-4 py-2 sm:px-6 sm:pt-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h1 className="text-base font-semibold sm:text-lg">
              <span className="sm:hidden">{title}</span>
              <span className="hidden sm:inline">スイングトレード支援</span>
            </h1>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 sm:text-xs">
              資金 {yen(settings.capital)} / 許容損失{' '}
              {yen((settings.capital * settings.riskPercent) / 100)}({settings.riskPercent}%)
              {openCount > 0 && ` / 建玉 ${openCount}件`}
            </p>
          </div>
          <TopTabBar tab={tab} onChange={setTab} badges={badges} />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-3 py-3 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 sm:pb-16">
        {storageError && (
          <div className="mb-3 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
            保存領域を使えないため、入力した内容はこのタブを閉じると消えます。
            プライベートブラウズを解除するか、ホーム画面に追加したアプリから開いてください。
          </div>
        )}

        {alerts.length > 0 && (
          <button
            type="button"
            onClick={() => setTab('positions')}
            className="mb-3 block w-full rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <p className="font-medium">確認したい建玉があります</p>
            <ul className="mt-1 list-disc pl-5">
              {alerts.map((alert) => (
                <li key={alert}>{alert}</li>
              ))}
            </ul>
          </button>
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

        <p className="mt-6 text-center text-[11px] text-neutral-400 dark:text-neutral-600">
          判断材料を整理するためのツールです。売買を推奨するものではありません。
        </p>
      </main>

      <BottomTabBar tab={tab} onChange={setTab} badges={badges} />
    </div>
  )
}
