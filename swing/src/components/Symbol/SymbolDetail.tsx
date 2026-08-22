import { useMemo, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { analyze, MIN_BARS, VERDICT_LABEL } from '../../lib/market/signals'
import { closes, sma } from '../../lib/market/indicators'
import { CandleChart, type Level } from './CandleChart'
import { TradePlan } from './TradePlan'
import { CompanyCard } from './CompanyCard'
import { count, percent, price, shortDate, toneClass } from '../../lib/format'
import { Badge, Card, EmptyState, Stat, subtleButtonClass } from '../ui/Primitives'
import { HelpButton } from '../Learn/HelpButton'
import { SIGNAL_TERMS } from '../../lib/learn/signalTerms'

const MA_COLORS = { sma5: '#f59e0b', sma25: '#2563eb', sma75: '#a855f7' }

export function SymbolDetail({ onGoImport }: { onGoImport: () => void }) {
  const stocks = useAppStore((s) => s.stocks)
  const series = useAppStore((s) => s.series)
  const selectedCode = useAppStore((s) => s.selectedCode)
  const select = useAppStore((s) => s.select)
  const removeStock = useAppStore((s) => s.removeStock)
  const clearSeries = useAppStore((s) => s.clearSeries)
  const [plan, setPlan] = useState<{ entry: number; stop: number; target: number } | null>(null)

  const stock = stocks.find((s) => s.code === selectedCode) ?? stocks[0] ?? null
  // series から取り出した配列をそのまま使うと毎回別物になり、下の useMemo が効かない。
  const bars = useMemo(() => (stock ? (series[stock.code] ?? []) : []), [stock, series])
  const analysis = useMemo(() => (bars.length >= 30 ? analyze(bars) : null), [bars])
  const overlays = useMemo(() => {
    const values = closes(bars)
    return [
      { label: '5日線', color: MA_COLORS.sma5, values: sma(values, 5) },
      { label: '25日線', color: MA_COLORS.sma25, values: sma(values, 25) },
      { label: '75日線', color: MA_COLORS.sma75, values: sma(values, 75) },
    ]
  }, [bars])

  if (!stock) {
    return (
      <EmptyState title="銘柄が選ばれていません">
        「監視」タブで銘柄を追加してください。
      </EmptyState>
    )
  }

  const snapshot = analysis?.snapshot
  const levels: Level[] = plan
    ? [
        { label: 'エントリー', value: plan.entry, color: '#525252' },
        { label: '損切り', value: plan.stop, color: '#0284c7' },
        { label: '利確', value: plan.target, color: '#e11d48' },
      ]
    : []

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <select
              value={stock.code}
              onChange={(e) => select(e.target.value)}
              className="min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-950 sm:w-auto sm:text-sm"
            >
              {stocks.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.code} {item.name}
                </option>
              ))}
            </select>
          </div>
          {bars.length > 0 && (
            <button
              type="button"
              aria-label="この銘柄の価格データを消す"
              className={`${subtleButtonClass} shrink-0 px-3`}
              onClick={() => {
                if (
                  confirm(
                    `${stock.name} の価格データ${bars.length}本を消しますか?銘柄・メモ・企業カルテは残ります。`,
                  )
                ) {
                  void clearSeries(stock.code)
                }
              }}
            >
              価格を消す
            </button>
          )}
          <button
            type="button"
            aria-label="この銘柄を削除"
            className={`${subtleButtonClass} shrink-0 px-3`}
            onClick={() => {
              if (confirm(`${stock.name} を削除しますか?価格データも消えます。`)) {
                void removeStock(stock.code)
              }
            }}
          >
            削除
          </button>
        </div>
        {analysis && (
          <div className="mt-2">
            <Badge tone={analysis.verdict === 'ready' ? 'bull' : analysis.verdict === 'avoid' ? 'bear' : 'info'}>
              スコア {analysis.score} / {VERDICT_LABEL[analysis.verdict]}
            </Badge>
          </div>
        )}
        {stock.memo && (
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{stock.memo}</p>
        )}

        {bars.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="価格データがありません">
              <p>「取込」タブで日足のCSVを読み込むか、当日の値を手入力してください。</p>
              <button type="button" className={`${subtleButtonClass} mt-3`} onClick={onGoImport}>
                取込タブへ
              </button>
            </EmptyState>
          </div>
        ) : (
          <div className="mt-4">
            <CandleChart bars={bars} overlays={overlays} levels={levels} />
            <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              {bars.length}本 / {shortDate(bars[0].date)}〜{shortDate(bars[bars.length - 1].date)}
              {bars.length < MIN_BARS && '(判定の精度を上げるには80本以上を推奨)'}
            </p>
          </div>
        )}
      </Card>

      {snapshot && analysis && (
        <>
          <Card title="いまの状態" description={`${snapshot.date} 終値ベース`}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="終値" help="ohlc" value={`${price(snapshot.close)}円`} tone={toneClass(snapshot.changeRate)} hint={percent(snapshot.changeRate)} />
              <Stat label="5日線" help="moving-average" value={price(snapshot.sma5)} />
              <Stat label="25日線" help="moving-average" value={price(snapshot.sma25)} hint={`乖離 ${percent(snapshot.deviation25)}`} />
              <Stat label="75日線" help="moving-average" value={price(snapshot.sma75)} />
              <Stat label="RSI(14)" help="rsi" value={snapshot.rsi14 === null ? '—' : snapshot.rsi14.toFixed(1)} hint="30以下で売られすぎ / 70以上で買われすぎ" />
              <Stat label="MACD" help="macd" value={snapshot.macd === null ? '—' : snapshot.macd.toFixed(1)} hint={`シグナル ${snapshot.macdSignal?.toFixed(1) ?? '—'}`} />
              <Stat label="ATR(14)" help="atr" value={`${price(snapshot.atr14)}円`} hint={`終値の${snapshot.atrRate?.toFixed(1) ?? '—'}%`} />
              <Stat label="出来高" help="volume" value={count(snapshot.volume)} hint={`20日平均の${snapshot.volumeRatio ? (snapshot.volumeRatio * 100).toFixed(0) : '—'}%`} />
              <Stat label="20日高値" help="high-low" value={price(snapshot.high20)} hint="前日までの高値" />
              <Stat label="20日安値" help="high-low" value={price(snapshot.low20)} hint="前日までの安値" />
              <Stat label="直近5日安値" help="stop-loss" value={price(snapshot.low5)} hint="損切り位置の候補" />
              <Stat label="ボリンジャー" help="bollinger" value={`${price(snapshot.bbLower)}〜${price(snapshot.bbUpper)}`} hint="20日 ±2σ" />
            </div>
          </Card>

          <Card
            title="チャートから読めること"
            description="買いの根拠になりそうな点と、警戒したい点を並べています。「?」で用語の意味を見られます。"
          >
            {analysis.signals.length === 0 ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                目立った特徴はありません。様子見の局面です。
              </p>
            ) : (
              <ul className="space-y-2">
                {analysis.signals.map((signal) => (
                  <li
                    key={signal.id}
                    className="flex items-start gap-3 rounded-xl bg-neutral-50 px-3 py-2 dark:bg-neutral-800/60"
                  >
                    <Badge tone={signal.tone}>{signal.label}</Badge>
                    <span className="flex-1 text-sm text-neutral-600 dark:text-neutral-300">
                      {signal.detail}
                    </span>
                    {SIGNAL_TERMS[signal.id] && (
                      <HelpButton term={SIGNAL_TERMS[signal.id]} label={signal.label} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      <TradePlan stock={stock} analysis={analysis} onPlanChange={setPlan} />

      <CompanyCard stock={stock} />
    </div>
  )
}
