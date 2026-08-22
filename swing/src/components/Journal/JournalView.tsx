import { useMemo, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { equityCurve, summarize } from '../../lib/money/stats'
import { evaluateTrade, isClosed, type Trade } from '../../lib/money/trade'
import { percent, price, ratio, shortDate, today, toneClass, yen } from '../../lib/format'
import {
  buttonClass,
  Card,
  EmptyState,
  Field,
  inputClass,
  Stat,
  subtleButtonClass,
} from '../ui/Primitives'

export function JournalView() {
  const trades = useAppStore((s) => s.trades)
  const closed = useMemo(
    () =>
      trades
        .filter(isClosed)
        .slice()
        .sort((a, b) => (b.exitDate ?? '').localeCompare(a.exitDate ?? '')),
    [trades],
  )
  const stats = useMemo(() => summarize(trades), [trades])
  const curve = useMemo(() => equityCurve(trades), [trades])

  return (
    <div className="space-y-4">
      <ManualTradeForm />

      {closed.length === 0 ? (
        <EmptyState title="まだ手仕舞い済みのトレードがありません">
          建玉を手仕舞うか、「設定」タブでSBI証券の取引履歴CSVを読み込むと成績が出ます。
        </EmptyState>
      ) : (
        <>
          <Card title="成績" description="手数料を引いた税引前の損益で集計しています。">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="トレード数" value={`${stats.total}回`} hint={`勝ち${stats.wins} / 負け${stats.losses}`} />
              <Stat help="win-rate" label="勝率" value={`${stats.winRate.toFixed(1)}%`} />
              <Stat label="損益合計" value={yen(stats.totalProfit)} tone={toneClass(stats.totalProfit)} />
              <Stat help="profit-factor" label="プロフィットファクター" value={ratio(stats.profitFactor)} hint="総利益÷総損失。1.0未満は負け越し" />
              <Stat label="平均利益" value={yen(stats.averageWin)} tone="text-rose-600 dark:text-rose-400" />
              <Stat label="平均損失" value={yen(-stats.averageLoss)} tone="text-sky-600 dark:text-sky-400" />
              <Stat help="payoff-ratio" label="ペイオフレシオ" value={ratio(stats.payoffRatio)} hint="平均利益÷平均損失" />
              <Stat
                help="expectancy"
                label="期待値"
                value={yen(stats.expectancy)}
                hint={stats.expectancyR === null ? '1トレードあたり' : `${ratio(stats.expectancyR)}R / トレード`}
                tone={toneClass(stats.expectancy)}
              />
              <Stat help="drawdown" label="最大ドローダウン" value={yen(-stats.maxDrawdown)} hint="累積損益の落ち込み幅" />
              <Stat label="最大連敗" value={`${stats.maxConsecutiveLosses}回`} />
              <Stat
                label="平均保有日数"
                value={stats.averageHoldingDays === null ? '—' : `${stats.averageHoldingDays.toFixed(1)}日`}
              />
              <Stat label="最大の勝ち / 負け" value={`${yen(stats.bestTrade)} / ${yen(stats.worstTrade)}`} />
            </div>

            {curve.length > 1 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold">累積損益</h3>
                <EquityChart points={curve} />
              </div>
            )}
          </Card>

          <Card
            title="トレード記録"
            description="振り返りを書き残すほど、次の判断が速くなります。"
            actions={<ExportButton trades={closed} />}
          >
            <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {closed.map((trade) => (
                <JournalRow key={trade.id} trade={trade} />
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  )
}

function JournalRow({ trade }: { trade: Trade }) {
  const updateTrade = useAppStore((s) => s.updateTrade)
  const removeTrade = useAppStore((s) => s.removeTrade)
  const result = evaluateTrade(trade)
  const [review, setReview] = useState(trade.review)
  const [editing, setEditing] = useState(false)

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-neutral-500 dark:text-neutral-400">{trade.code}</span>
            <span className="font-medium">{trade.name}</span>
          </div>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {shortDate(trade.entryDate)} {price(trade.entryPrice)}円 → {shortDate(trade.exitDate)}{' '}
            {price(trade.exitPrice)}円 / {trade.shares.toLocaleString('ja-JP')}株
            {result.holdingDays !== null && ` / ${result.holdingDays}日`}
          </p>
          {trade.reason && (
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">根拠: {trade.reason}</p>
          )}
        </div>
        <div className="text-right">
          <div className={`font-semibold tabular-nums ${toneClass(result.profit)}`}>{yen(result.profit)}</div>
          <div className={`text-sm tabular-nums ${toneClass(result.profit)}`}>
            {percent(result.profitPercent)}
            {result.rMultiple !== null && ` / ${ratio(result.rMultiple)}R`}
          </div>
        </div>
      </div>

      {editing ? (
        <div className="mt-2">
          <textarea
            className={`${inputClass} min-h-20`}
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="計画どおりに損切りできたか、待てたか、次はどうするか"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className={buttonClass}
              onClick={() => {
                void updateTrade(trade.id, { review })
                setEditing(false)
              }}
            >
              保存
            </button>
            <button type="button" className={subtleButtonClass} onClick={() => setEditing(false)}>
              取消
            </button>
            <button
              type="button"
              className={subtleButtonClass}
              onClick={() => {
                if (confirm('この記録を削除しますか?')) void removeTrade(trade.id)
              }}
            >
              削除
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-2 w-full rounded-lg bg-neutral-50 px-3 py-2 text-left text-sm text-neutral-600 transition hover:bg-neutral-100 dark:bg-neutral-800/60 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          {trade.review || '振り返りを書く'}
        </button>
      )}
    </li>
  )
}

function EquityChart({ points }: { points: { date: string; equity: number }[] }) {
  const width = 640
  const height = 120
  const values = points.map((p) => p.equity)
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const span = max - min || 1
  const x = (i: number) => (i / Math.max(1, points.length - 1)) * width
  const y = (value: number) => height - ((value - min) / span) * height
  const path = points
    .map((point, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(point.equity).toFixed(1)}`)
    .join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-auto w-full" role="img" aria-label="累積損益">
      <line
        x1={0}
        x2={width}
        y1={y(0)}
        y2={y(0)}
        className="stroke-neutral-300 dark:stroke-neutral-700"
        strokeDasharray="4 4"
      />
      <path d={path} fill="none" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth={1.6} />
    </svg>
  )
}

function ExportButton({ trades }: { trades: Trade[] }) {
  const download = () => {
    const header = [
      '銘柄コード',
      '銘柄名',
      'エントリー日',
      'エントリー価格',
      '株数',
      '損切り価格',
      '売却日',
      '売却価格',
      '手数料',
      '損益',
      'R倍',
      '根拠',
      '振り返り',
    ]
    const rows = trades.map((trade) => {
      const result = evaluateTrade(trade)
      return [
        trade.code,
        trade.name,
        trade.entryDate,
        trade.entryPrice,
        trade.shares,
        trade.stopPrice ?? '',
        trade.exitDate ?? '',
        trade.exitPrice ?? '',
        trade.fees,
        Math.round(result.profit),
        result.rMultiple === null ? '' : result.rMultiple.toFixed(2),
        trade.reason.replace(/"/g, '""'),
        trade.review.replace(/"/g, '""'),
      ]
    })
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\r\n')
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `swing-journal-${today()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button type="button" className={subtleButtonClass} onClick={download}>
      CSVで書き出し
    </button>
  )
}

function ManualTradeForm() {
  const stocks = useAppStore((s) => s.stocks)
  const addTrade = useAppStore((s) => s.addTrade)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    code: '',
    name: '',
    entryDate: today(),
    entryPrice: '',
    shares: '',
    stopPrice: '',
    exitDate: '',
    exitPrice: '',
    fees: '',
    reason: '',
  })

  const set = (key: keyof typeof form, value: string) => setForm({ ...form, [key]: value })

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.code || !form.entryPrice || !form.shares) return
    await addTrade({
      code: form.code.toUpperCase(),
      name: form.name || stocks.find((s) => s.code === form.code.toUpperCase())?.name || form.code,
      entryDate: form.entryDate,
      entryPrice: Number(form.entryPrice),
      shares: Number(form.shares),
      stopPrice: form.stopPrice ? Number(form.stopPrice) : null,
      exitDate: form.exitDate || null,
      exitPrice: form.exitPrice ? Number(form.exitPrice) : null,
      fees: Number(form.fees) || 0,
      reason: form.reason,
    })
    setForm({ ...form, entryPrice: '', shares: '', stopPrice: '', exitDate: '', exitPrice: '', fees: '', reason: '' })
    setOpen(false)
  }

  return (
    <Card
      title="記録を手で追加"
      description="アプリを使う前のトレードや、S株での売買もここから残せます。"
      actions={
        <button type="button" className={subtleButtonClass} onClick={() => setOpen((v) => !v)}>
          {open ? '閉じる' : '入力する'}
        </button>
      }
    >
      {open && (
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
          <Field label="コード">
            <input className={inputClass} value={form.code} onChange={(e) => set('code', e.target.value)} />
          </Field>
          <Field label="銘柄名">
            <input className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="エントリー日">
            <input type="date" className={inputClass} value={form.entryDate} onChange={(e) => set('entryDate', e.target.value)} />
          </Field>
          <Field label="エントリー価格">
            <input className={inputClass} value={form.entryPrice} onChange={(e) => set('entryPrice', e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="株数">
            <input className={inputClass} value={form.shares} onChange={(e) => set('shares', e.target.value)} inputMode="numeric" />
          </Field>
          <Field label="損切り価格(任意)">
            <input className={inputClass} value={form.stopPrice} onChange={(e) => set('stopPrice', e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="売却日(任意)">
            <input type="date" className={inputClass} value={form.exitDate} onChange={(e) => set('exitDate', e.target.value)} />
          </Field>
          <Field label="売却価格(任意)">
            <input className={inputClass} value={form.exitPrice} onChange={(e) => set('exitPrice', e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="手数料(任意)">
            <input className={inputClass} value={form.fees} onChange={(e) => set('fees', e.target.value)} inputMode="decimal" />
          </Field>
          <div className="sm:col-span-3">
            <Field label="エントリー根拠">
              <input className={inputClass} value={form.reason} onChange={(e) => set('reason', e.target.value)} />
            </Field>
          </div>
          <div className="sm:col-span-3">
            <button type="submit" className={buttonClass}>
              追加する
            </button>
          </div>
        </form>
      )}
    </Card>
  )
}
