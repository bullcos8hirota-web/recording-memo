import { useMemo, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { atr as atrSeries } from '../../lib/market/indicators'
import { chandelierStop } from '../../lib/money/position'
import { evaluateTrade, isClosed, type Trade } from '../../lib/money/trade'
import { openExposure } from '../../lib/money/stats'
import { capitalGainTax, tradeFee } from '../../lib/money/fees'
import { percent, price, ratio, shortDate, today, toneClass, yen } from '../../lib/format'
import {
  Badge,
  buttonClass,
  Card,
  EmptyState,
  Field,
  inputClass,
  Stat,
  subtleButtonClass,
} from '../ui/Primitives'
import type { Bar } from '../../lib/market/types'

export function PositionsView() {
  const trades = useAppStore((s) => s.trades)
  const series = useAppStore((s) => s.series)
  const settings = useAppStore((s) => s.settings)
  const open = trades.filter((t) => !isClosed(t))

  const exposure = openExposure(trades)
  const unrealized = open.reduce((sum, trade) => {
    const bars = series[trade.code] ?? []
    const last = bars[bars.length - 1]?.close ?? null
    return sum + evaluateTrade(trade, last).profit
  }, 0)

  if (open.length === 0) {
    return (
      <EmptyState title="保有中の建玉はありません">
        「銘柄」タブで売買プランを作ると、ここに記録できます。
      </EmptyState>
    )
  }

  return (
    <div className="space-y-4">
      <Card title="建玉サマリー">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="保有銘柄数" value={`${open.length}件`} />
          <Stat help="position" label="投入資金" value={yen(exposure)} hint={`資金の${((exposure / settings.capital) * 100).toFixed(1)}%`} />
          <Stat help="unrealized" label="含み損益" value={yen(unrealized)} tone={toneClass(unrealized)} />
          <Stat label="現金余力(概算)" value={yen(settings.capital - exposure)} />
        </div>
      </Card>

      {open.map((trade) => (
        <PositionCard key={trade.id} trade={trade} bars={series[trade.code] ?? []} />
      ))}
    </div>
  )
}

function PositionCard({ trade, bars }: { trade: Trade; bars: Bar[] }) {
  const updateTrade = useAppStore((s) => s.updateTrade)
  const removeTrade = useAppStore((s) => s.removeTrade)
  const feeConfig = useAppStore((s) => s.settings.feeConfig)
  const atrMultiple = useAppStore((s) => s.settings.atrMultiple)

  const last = bars[bars.length - 1] ?? null
  const result = evaluateTrade(trade, last?.close ?? null)
  const [exitDate, setExitDate] = useState(today())
  const [exitPrice, setExitPrice] = useState(String(last?.close ?? trade.entryPrice))
  const [stopInput, setStopInput] = useState(trade.stopPrice === null ? '' : String(trade.stopPrice))
  const [closing, setClosing] = useState(false)

  const trailing = useMemo(() => {
    if (!bars.length) return null
    const since = bars.filter((bar) => bar.date >= trade.entryDate)
    if (since.length < 3) return null
    const highs = Math.max(...since.map((bar) => bar.high))
    const atrValue = atrSeries(bars, 14)[bars.length - 1]
    if (atrValue === null || atrValue === undefined) return null
    return chandelierStop(highs, atrValue, atrMultiple + 0.5)
  }, [bars, trade.entryDate, atrMultiple])

  // 損切りは上げるだけ。下げると許容していたはずの損失が広がってしまう。
  const canRaiseStop =
    trailing !== null && (trade.stopPrice === null || trailing > trade.stopPrice)

  const status = (() => {
    if (!last) return { tone: 'neutral' as const, text: '価格データがありません' }
    if (trade.stopPrice !== null && last.close <= trade.stopPrice) {
      return { tone: 'bear' as const, text: '損切りラインに到達しています' }
    }
    if (trade.targetPrice !== null && last.close >= trade.targetPrice) {
      return { tone: 'bull' as const, text: '利確ラインに到達しています' }
    }
    if (trailing !== null && last.close <= trailing && result.profit > 0) {
      return { tone: 'info' as const, text: 'トレーリングストップに接近しています' }
    }
    return { tone: 'neutral' as const, text: '保有継続' }
  })()

  const closeTrade = async () => {
    const priceValue = Number(exitPrice)
    if (!priceValue) return
    const exitFee = tradeFee(priceValue * trade.shares, feeConfig)
    await updateTrade(trade.id, {
      exitDate,
      exitPrice: priceValue,
      fees: (trade.fees || 0) + exitFee,
    })
    setClosing(false)
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-neutral-500 dark:text-neutral-400">{trade.code}</span>
            <span className="font-medium">{trade.name}</span>
            <Badge tone={status.tone}>{status.text}</Badge>
          </div>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {shortDate(trade.entryDate)} に {price(trade.entryPrice)}円 × {trade.shares.toLocaleString('ja-JP')}株
            {result.holdingDays !== null && ` / 保有${result.holdingDays}日`}
          </p>
          {trade.reason && (
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">根拠: {trade.reason}</p>
          )}
        </div>
        <div className="text-right">
          <div className={`text-xl font-semibold tabular-nums ${toneClass(result.profit)}`}>
            {yen(result.profit)}
          </div>
          <div className={`text-sm tabular-nums ${toneClass(result.profit)}`}>
            {percent(result.profitPercent)}
            {result.rMultiple !== null && ` / ${ratio(result.rMultiple)}R`}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="現在値" value={last ? `${price(last.close)}円` : '—'} hint={last ? `${shortDate(last.date)}時点` : undefined} />
        <Stat help="stop-loss" label="損切り" value={trade.stopPrice === null ? '未設定' : `${price(trade.stopPrice)}円`} />
        <Stat
          help="take-profit"
          label="利確目標"
          value={trade.targetPrice === null ? 'なし' : `${price(trade.targetPrice)}円`}
          hint={trade.targetPrice === null ? 'トレーリングで出口を決めます' : undefined}
        />
        <Stat
          help="trailing-stop"
          label="トレーリング目安"
          value={trailing === null ? '—' : `${price(trailing)}円`}
          hint={
            trailing === null
              ? '高値からATR分下'
              : canRaiseStop
                ? '損切りをここまで上げられます'
                : '今の損切りより下。今週は動かしません'
          }
        />
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <Field label="損切りを更新(円)" help="stop-order">
          <input
            className={`${inputClass} w-32`}
            value={stopInput}
            onChange={(e) => setStopInput(e.target.value)}
            inputMode="decimal"
          />
        </Field>
        <button
          type="button"
          className={subtleButtonClass}
          onClick={() => void updateTrade(trade.id, { stopPrice: Number(stopInput) || null })}
        >
          更新
        </button>
        {canRaiseStop && (
          <button
            type="button"
            className={subtleButtonClass}
            onClick={() => {
              setStopInput(String(trailing))
              void updateTrade(trade.id, { stopPrice: trailing })
            }}
          >
            損切りを{price(trailing!)}円に上げる
          </button>
        )}
        {trade.targetPrice !== null && (
          <button
            type="button"
            className={subtleButtonClass}
            onClick={() => void updateTrade(trade.id, { targetPrice: null })}
          >
            利確目標を消す
          </button>
        )}
        <div className="grow" />
        <button
          type="button"
          className={subtleButtonClass}
          onClick={() => {
            if (confirm('この建玉の記録を削除しますか?買っていないのに記録した場合はこちらです。')) {
              void removeTrade(trade.id)
            }
          }}
        >
          記録を削除
        </button>
        <button type="button" className={buttonClass} onClick={() => setClosing((v) => !v)}>
          {closing ? '閉じる' : '売却を記録'}
        </button>
      </div>

      {closing && (
        <div className="mt-3 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-800/60">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="売却日">
              <input
                type="date"
                className={inputClass}
                value={exitDate}
                onChange={(e) => setExitDate(e.target.value)}
              />
            </Field>
            <Field label="売却価格(円)">
              <input
                className={inputClass}
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
                inputMode="decimal"
              />
            </Field>
            <div className="self-end text-sm text-neutral-600 dark:text-neutral-300">
              確定損益の見込み:{' '}
              <span className={toneClass(estimateProfit(trade, Number(exitPrice), feeConfig))}>
                {yen(estimateProfit(trade, Number(exitPrice), feeConfig))}
              </span>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                税引後 {yen(afterTax(estimateProfit(trade, Number(exitPrice), feeConfig)))}
              </div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" className={buttonClass} onClick={() => void closeTrade()}>
              確定する
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}

function estimateProfit(
  trade: Trade,
  exitPrice: number,
  feeConfig: Parameters<typeof tradeFee>[1],
): number {
  if (!exitPrice) return 0
  const direction = trade.side === 'long' ? 1 : -1
  const gross = (exitPrice - trade.entryPrice) * trade.shares * direction
  return gross - (trade.fees || 0) - tradeFee(exitPrice * trade.shares, feeConfig)
}

function afterTax(profit: number): number {
  return profit - capitalGainTax(profit)
}
