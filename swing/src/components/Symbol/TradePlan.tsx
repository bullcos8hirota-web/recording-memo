import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import type { Analysis } from '../../lib/market/signals'
import type { Stock } from '../../lib/market/types'
import { buildExitPlan, calculatePosition, stopCandidates } from '../../lib/money/position'
import { capitalGainTax, tradeFee } from '../../lib/money/fees'
import { percent, price, ratio, today, yen } from '../../lib/format'
import { buttonClass, Card, Field, inputClass, NumberField, Stat } from '../ui/Primitives'
import { HelpButton } from '../Learn/HelpButton'

/**
 * 「いくらで、何株、どこで損切りするか」を先に決めるための画面。
 * 株数は許容損失から逆算するので、損切り価格を動かすと株数も変わる。
 */
export function TradePlan({
  stock,
  analysis,
  onPlanChange,
}: {
  stock: Stock
  analysis: Analysis | null
  onPlanChange?: (plan: { entry: number; stop: number; target: number } | null) => void
}) {
  const settings = useAppStore((s) => s.settings)
  const addTrade = useAppStore((s) => s.addTrade)
  const snapshot = analysis?.snapshot ?? null

  const [entryInput, setEntryInput] = useState('')
  const [stopInput, setStopInput] = useState('')
  const [rewardRatio, setRewardRatio] = useState(settings.rewardRatio)
  const [saved, setSaved] = useState<string | null>(null)

  const candidates = useMemo(
    () =>
      snapshot
        ? stopCandidates({
            entry: Number(entryInput) || snapshot.close,
            atr: snapshot.atr14,
            low5: snapshot.low5,
            sma25: snapshot.sma25,
            atrMultiple: settings.atrMultiple,
          })
        : [],
    [snapshot, entryInput, settings.atrMultiple],
  )

  // 銘柄を切り替えたら、直近終値とATR基準の損切りで引き直す。
  useEffect(() => {
    if (!snapshot) return
    setEntryInput(String(snapshot.close))
    const atrStop =
      snapshot.atr14 !== null ? snapshot.close - snapshot.atr14 * settings.atrMultiple : null
    const fallback = snapshot.low5 !== null ? snapshot.low5 * 0.995 : snapshot.close * 0.95
    setStopInput(String(Math.round(atrStop ?? fallback)))
    setSaved(null)
  }, [stock.code, snapshot, settings.atrMultiple])

  const entry = Number(entryInput) || 0
  const stop = Number(stopInput) || 0
  const plan = buildExitPlan(entry, stop, rewardRatio)
  const { entry: planEntry, stop: planStop, target: planTarget } = plan
  const sizing = calculatePosition({
    capital: settings.capital,
    riskPercent: settings.riskPercent,
    maxPositionPercent: settings.maxPositionPercent,
    entryPrice: plan.entry,
    stopPrice: plan.stop,
    lot: stock.lot,
    feeConfig: settings.feeConfig,
  })

  // チャートに水平線を描くため、確定したプランを親に渡す。
  useEffect(() => {
    onPlanChange?.(
      planEntry > 0 && planStop > 0
        ? { entry: planEntry, stop: planStop, target: planTarget }
        : null,
    )
  }, [planEntry, planStop, planTarget, onPlanChange])

  const grossProfit = plan.rewardPerShare * sizing.shares
  const exitFee = tradeFee(plan.target * sizing.shares, settings.feeConfig)
  const entryFee = tradeFee(plan.entry * sizing.shares, settings.feeConfig)
  const netProfit = grossProfit - entryFee - exitFee
  const afterTax = netProfit - capitalGainTax(netProfit)

  const record = async () => {
    if (sizing.shares <= 0) return
    await addTrade({
      code: stock.code,
      name: stock.name,
      entryDate: today(),
      entryPrice: plan.entry,
      shares: sizing.shares,
      stopPrice: plan.stop,
      targetPrice: plan.target,
      fees: entryFee,
      reason:
        analysis?.signals
          .filter((s) => s.tone === 'bull')
          .map((s) => s.label)
          .join('、') ?? '',
    })
    setSaved(`${stock.name} ${sizing.shares}株の建玉を記録しました。`)
  }

  return (
    <Card
      title="売買プラン"
      description="許容損失から株数を決めます。損切り価格を先に決めるのがスイングの肝です。"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="エントリー価格(円)" help="order-type">
          <input
            className={inputClass}
            value={entryInput}
            onChange={(e) => setEntryInput(e.target.value)}
            inputMode="decimal"
          />
        </Field>
        <Field label="損切り価格(円)" help="stop-loss" hint={`呼値に丸めて ${price(plan.stop)}円`}>
          <input
            className={inputClass}
            value={stopInput}
            onChange={(e) => setStopInput(e.target.value)}
            inputMode="decimal"
          />
        </Field>
        <NumberField
          label="利確倍率(リスクの何倍)"
          help="risk-reward"
          className="col-span-2 sm:col-span-1"
          value={rewardRatio}
          onCommit={setRewardRatio}
        />
      </div>

      {candidates.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {candidates.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              title={candidate.note}
              onClick={() => setStopInput(String(candidate.price))}
              className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
            >
              {candidate.label}: {price(candidate.price)}円
            </button>
          ))}
        </div>
      )}

      {sizing.error ? (
        <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {sizing.error}
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat
              help="position-sizing"
              label="株数"
              value={`${sizing.shares.toLocaleString('ja-JP')}株`}
              hint={sizing.limitedBy === 'position-cap' ? '1銘柄あたりの上限で頭打ち' : '許容損失から逆算'}
            />
            <Stat help="spot-trading" label="必要資金" value={yen(sizing.cost)} hint={`資金の${((sizing.cost / settings.capital) * 100).toFixed(1)}%`} />
            <Stat
              help="risk-per-trade"
              label="想定損失"
              value={yen(-sizing.riskAmount)}
              hint={`資金の${sizing.riskRatio.toFixed(2)}%`}
              tone="text-sky-600 dark:text-sky-400"
            />
            <Stat
              help="tax"
              label="想定利益(税引後)"
              value={yen(afterTax)}
              hint={`利確 ${price(plan.target)}円`}
              tone="text-rose-600 dark:text-rose-400"
            />
          </div>

          <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <Row label="損切りまでの値幅" value={`${price(plan.riskPerShare)}円 (${percent(-plan.riskPercent)})`} />
            <Row label="利確までの値幅" value={`${price(plan.rewardPerShare)}円 (${percent(plan.rewardPercent)})`} />
            <Row help="risk-reward" label="リスクリワード" value={`1 : ${ratio(plan.rewardRatio)}`} />
            <Row help="commission" label="手数料(往復概算)" value={yen(entryFee + exitFee)} />
          </dl>
        </>
      )}

      <div className="mt-5 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={buttonClass}
            disabled={sizing.shares <= 0}
            onClick={() => void record()}
          >
            この計画で建玉を記録
          </button>
          {saved && <span className="text-sm text-neutral-500 dark:text-neutral-400">{saved}</span>}
        </div>
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          記録するのは、実際にSBI証券で買えたあとにしてください。
        </p>
      </div>
    </Card>
  )
}

function Row({ label, value, help }: { label: string; value: string; help?: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-dashed border-neutral-200 py-1 dark:border-neutral-800">
      <dt className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
        {label}
        {help && <HelpButton term={help} label={label} />}
      </dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}
