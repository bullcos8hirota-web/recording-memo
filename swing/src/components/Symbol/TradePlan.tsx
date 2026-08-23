import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { VERDICT_LABEL, type Analysis } from '../../lib/market/signals'
import type { Stock } from '../../lib/market/types'
import {
  buildExitPlan,
  calculatePosition,
  entryCandidates,
  stopCandidates,
} from '../../lib/money/position'
import { capitalGainTax, tradeFee } from '../../lib/money/fees'
import { percent, price, ratio, shortDate, today, yen } from '../../lib/format'
import {
  buttonClass,
  Card,
  Field,
  inputClass,
  NumberField,
  Stat,
  subtleButtonClass,
} from '../ui/Primitives'
import { HelpButton } from '../Learn/HelpButton'
import { earningsAlert } from '../../lib/market/earnings'

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
  const ready = analysis?.verdict === 'ready'
  const earnings = earningsAlert(stock.earningsDate)

  const [entryInput, setEntryInput] = useState('')
  const [stopInput, setStopInput] = useState('')
  const [rewardRatio, setRewardRatio] = useState(settings.rewardRatio)
  const [saved, setSaved] = useState<string | null>(null)
  const [forceOrder, setForceOrder] = useState(false)
  // 損切りを自分で決めたあとは、エントリー価格を変えても勝手に動かさない。
  const [stopPinned, setStopPinned] = useState(false)
  // 条件が揃っていない銘柄では、数字ごと畳んでおく。
  // 目の前に注文の材料があると、判定を読み飛ばして手が動いてしまう。
  const showPlan = analysis === null || analysis.verdict === 'ready' || forceOrder

  const entries = useMemo(
    () =>
      snapshot
        ? entryCandidates({ close: snapshot.close, high: snapshot.high, high20: snapshot.high20 })
        : [],
    [snapshot],
  )

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

  // 銘柄を切り替えたら、直近の高値の少し上とATR基準の損切りで引き直す。
  // 損切りは終値ではなく、この既定のエントリー価格から引く(でないと最初から食い違う)。
  useEffect(() => {
    if (!snapshot) return
    const suggested = entryCandidates({
      close: snapshot.close,
      high: snapshot.high,
      high20: snapshot.high20,
    })[0]
    const entry = suggested?.price ?? snapshot.close
    setEntryInput(String(entry))
    const atrStop = snapshot.atr14 !== null ? entry - snapshot.atr14 * settings.atrMultiple : null
    const fallback = snapshot.low5 !== null ? snapshot.low5 * 0.995 : entry * 0.95
    setStopInput(String(Math.round(atrStop ?? fallback)))
    setForceOrder(false)
    setStopPinned(false)
    setSaved(null)
  }, [stock.code, snapshot, settings.atrMultiple])

  // 約定価格を入れ直したら、損切りもその価格から引き直す。
  // 買えたあとに手計算させないための追従(自分で損切りを決めたときは止まる)。
  useEffect(() => {
    if (stopPinned || !snapshot || snapshot.atr14 === null) return
    const typed = Number(entryInput)
    if (!typed) return
    setStopInput(String(Math.round(typed - snapshot.atr14 * settings.atrMultiple)))
  }, [entryInput, stopPinned, snapshot, settings.atrMultiple])

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
      // トレーリングで運用するなら、上限になる利確価格は記録しない。
      targetPrice: settings.exitStyle === 'trailing' ? null : plan.target,
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
      {analysis && !ready && (
        <div className="mb-3 rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-medium">
            今は買う場面ではありません（{VERDICT_LABEL[analysis.verdict]} / スコア{analysis.score}）
          </p>
          <p className="mt-1 text-xs">
            見送る場面です。株数や損切りを試したいときだけ、下のボタンから開いてください。
          </p>
          {!forceOrder && (
            <button
              type="button"
              className={`${subtleButtonClass} mt-2`}
              onClick={() => setForceOrder(true)}
            >
              それでも売買プランを見る
            </button>
          )}
        </div>
      )}

      {analysis && ready && (
        <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          買う条件が揃っています（スコア{analysis.score}）
        </p>
      )}

      {showPlan && (
        <>
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
              onChange={(e) => {
                setStopPinned(true)
                setStopInput(e.target.value)
              }}
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

        {entries.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              エントリー価格の候補（押すと上の欄に入ります）
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              {entries.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  title={candidate.note}
                  onClick={() => setEntryInput(String(candidate.price))}
                  className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                >
                  {candidate.label}: {price(candidate.price)}円
                </button>
              ))}
            </div>
          </div>
        )}

        {candidates.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              損切り価格の候補（押すと上の欄に入ります）
            </p>
          </div>
        )}
        {candidates.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {candidates.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                title={candidate.note}
                onClick={() => {
                  setStopPinned(true)
                  setStopInput(String(candidate.price))
                }}
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

          {earnings?.soon && (
            <div className="mt-4 rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="font-medium">
                決算発表が{shortDate(stock.earningsDate!)}（あと{earnings.days}日）です
              </p>
              <p className="mt-1 text-xs">
                決算の翌朝は、損切り価格を飛び越えて下で始まることがあります。
                チャートからは読めない唯一のリスクなので、発表後まで待つのが無難です。
              </p>
            </div>
          )}

          {sizing.shares > 0 && (
          <div className="mt-4 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
            <h3 className="text-sm font-semibold">証券会社に入れる注文</h3>
            {!ready && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                判定は「{analysis ? VERDICT_LABEL[analysis.verdict] : '—'}」です。条件は揃っていません。
              </p>
            )}
            <ol className="mt-2 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
              <li>
                <span className="font-medium">1. 買い注文（今すぐ）</span>
                <br />
                {stock.code} {stock.name} / 現物買い / {sizing.shares.toLocaleString('ja-JP')}株 /
                執行条件 <span className="font-medium">逆指値</span> /{' '}
                <span className="font-medium tabular-nums">{price(plan.entry)}円</span>
                <span className="font-medium">以上になったら</span> / 成行
              </li>
              <li>
                <span className="font-medium">2. 売り注文（買えたあと）</span>
                <br />
                現物売 / {sizing.shares.toLocaleString('ja-JP')}株 / 執行条件{' '}
                <span className="font-medium">逆指値</span> /{' '}
                <span className="font-medium tabular-nums">{price(plan.stop)}円</span>
                <span className="font-medium">以下になったら</span> / 成行
                {settings.exitStyle === 'target' && (
                  <>
                    {' '}
                    ＋ 利確の売り指値{' '}
                    <span className="font-medium tabular-nums">{price(plan.target)}円</span>
                  </>
                )}
              </li>
            </ol>
            <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              買えたら、上の「エントリー価格」に実際の約定価格を入れ直してください。
              2つめの売り注文の価格も、それに合わせて動きます（計算は要りません）。
            </p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              買いは「以上」、売りは「以下」です。逆にすると、下がったところで買う注文や、
            上がったところで売る注文になります。
          </p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            アプリの数字は手元のメモです。実際に売り買いするのは証券会社に出した注文だけなので、
              2つめを入れるまでが1セットです。
              {settings.exitStyle === 'trailing' &&
                '利確の注文は出しません。毎週末、建玉タブのトレーリング目安まで売りの逆指値を引き上げていきます。'}
            </p>
          </div>
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
            {settings.exitStyle === 'trailing'
              ? '出口はトレーリング(設定タブ)なので、利確目標は記録しません。上の利確価格は「損切り幅の何倍か」を見るための目安です。'
              : '出口は利確目標(設定タブ)なので、上の利確価格をそのまま記録します。'}
          </p>
        </div>
        </>
      )}
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
