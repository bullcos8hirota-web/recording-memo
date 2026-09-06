import { useMemo, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { weeklyPlan } from '../../lib/plan/weekly'
import { comingFriday, price, shortDate, today, yen } from '../../lib/format'
import { Card, subtleButtonClass } from '../ui/Primitives'

/**
 * 「今週やること」。
 *
 * 点数を並べるだけでは、結局どれを買うのか分からない。毎週の判断は決まった手順なので、
 * 落とした理由まで含めてここに出す。何もしない週は、何もしないと書く。
 */
export function WeeklyPlanCard({ onOpen }: { onOpen: (code: string) => void }) {
  const stocks = useAppStore((s) => s.stocks)
  const series = useAppStore((s) => s.series)
  const trades = useAppStore((s) => s.trades)
  const settings = useAppStore((s) => s.settings)
  const updateStock = useAppStore((s) => s.updateStock)
  const updateTrade = useAppStore((s) => s.updateTrade)
  const [showSkipped, setShowSkipped] = useState(false)

  const plan = useMemo(
    () => weeklyPlan({ stocks, series, trades, settings }),
    [stocks, series, trades, settings],
  )

  if (stocks.length === 0) return null

  const riskPercent = settings.capital > 0 ? (plan.totalRisk / settings.capital) * 100 : 0

  return (
    <Card
      title="今週やること"
      description="株価を更新するたびに引き直します。注文の数字はそのまま証券会社に入れられます。"
    >
      {plan.nothingToDo && (
        <p className="mb-3 rounded-xl bg-neutral-100 px-3 py-3 text-sm dark:bg-neutral-800">
          {plan.pending.length > 0 ? (
            <>
              <span className="font-medium">新しく出す注文はありません。</span>
              <span className="mt-1 block text-neutral-600 dark:text-neutral-300">
                出してある注文の約定を待ちます。約定したら、銘柄タブの「約定した」を押してください。
              </span>
            </>
          ) : (
            <>
              <span className="font-medium">今週は何もしません。</span>
              <span className="mt-1 block text-neutral-600 dark:text-neutral-300">
                条件が揃った銘柄が無く、損切りも動かす必要がありません。動かないことも判断のうちです。
              </span>
            </>
          )}
        </p>
      )}

      {/* 出す注文 */}
      {plan.orders.map((order) => (
        <div
          key={order.code}
          className="mb-3 rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100"
        >
          <button
            type="button"
            className="text-left text-base font-semibold underline-offset-2 hover:underline"
            onClick={() => onOpen(order.code)}
          >
            {order.code} {order.name} を買う注文を出す
          </button>
          <dl className="mt-2 grid grid-cols-[6.5rem_1fr] gap-y-1">
            <dt>取引</dt>
            <dd className="font-medium">現物買い</dd>
            <dt>株数</dt>
            <dd className="font-medium tabular-nums">
              {order.shares.toLocaleString('ja-JP')}株
            </dd>
            <dt>執行条件</dt>
            <dd className="font-medium">逆指値</dd>
            <dt>条件</dt>
            <dd className="font-medium tabular-nums">
              {price(order.trigger)}円 以上になったら
            </dd>
            <dt>価格</dt>
            <dd className="font-medium">成行</dd>
            <dt>期間</dt>
            <dd className="font-medium">今週中（{shortDate(comingFriday())}まで）</dd>
          </dl>
          <p className="mt-2">
            買えたら、売りの逆指値 <span className="font-medium">{price(order.stopPrice)}円</span>
            <span className="font-medium">以下になったら</span> / 成行 を続けて入れます。
            負けたときの損は {yen(order.risk)}（資金の
            {((order.risk / settings.capital) * 100).toFixed(2)}%）です。
          </p>
          {order.earningsUnknown && (
            <p className="mt-2 text-amber-800 dark:text-amber-300">
              この銘柄の決算発表日が未登録です。決算をまたぐと損切りを飛び越えて始まることがあるので、
              発注前にSBI証券アプリで確認し、2週間以内なら見送ってください。
            </p>
          )}
          <button
            type="button"
            className={`${subtleButtonClass} mt-2`}
            onClick={() =>
              void updateStock(order.code, {
                pendingOrder: {
                  trigger: order.trigger,
                  shares: order.shares,
                  stopPrice: order.stopPrice,
                  expiresOn: comingFriday(),
                  placedOn: today(),
                },
              })
            }
          >
            この内容で注文を出した
          </button>
        </div>
      ))}

      {/* 証券会社に出してある注文 */}
      {plan.pending.map((item) => (
        <div
          key={item.code}
          className={`mb-3 rounded-xl px-3 py-3 text-sm ${
            item.expired
              ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
              : 'bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200'
          }`}
        >
          <button
            type="button"
            className="text-left font-medium underline-offset-2 hover:underline"
            onClick={() => onOpen(item.code)}
          >
            {item.code} {item.name}：{item.expired ? '注文の期限が過ぎています' : '注文中'}
          </button>
          <p className="mt-1 tabular-nums">
            逆指値 {price(item.trigger)}円以上 / {item.shares.toLocaleString('ja-JP')}株 / 損切り{' '}
            {price(item.stopPrice)}円 / {shortDate(item.expiresOn)}まで
          </p>
          <p className="mt-1 text-xs">
            {item.expired
              ? '約定していなければ証券会社側でも失効しています。銘柄タブで消してください。'
              : '約定したら、銘柄タブの「約定した」を押してください。'}
          </p>
        </div>
      ))}

      {/* 建玉 */}
      {plan.positions.map((item) => (
        <div
          key={item.code}
          className={`mb-3 rounded-xl px-3 py-3 text-sm ${
            item.kind === 'hold-stop' && item.warnings.length === 0
              ? 'bg-neutral-100 dark:bg-neutral-800'
              : 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
          }`}
        >
          <button
            type="button"
            className="text-left font-medium underline-offset-2 hover:underline"
            onClick={() => onOpen(item.code)}
          >
            {item.code} {item.name}：
            {item.kind === 'set-stop'
              ? '損切りを決めてください'
              : item.kind === 'raise-stop'
                ? `損切りを ${price(item.raiseTo!)}円 に上げる`
                : `損切り ${price(item.stopPrice!)}円 のまま`}
          </button>
          <p className="mt-1">{item.note}</p>
          {item.warnings.map((warning) => (
            <p key={warning} className="mt-1 font-medium">
              {warning}
            </p>
          ))}
          {item.kind === 'raise-stop' && item.raiseTo !== null && (
            <div className="mt-2">
              <p className="tabular-nums">
                証券会社の売り注文を訂正：逆指値 {price(item.raiseTo)}円
                <span className="font-medium">以下になったら</span> / 成行 /{' '}
                {item.shares.toLocaleString('ja-JP')}株
              </p>
              <button
                type="button"
                className={`${subtleButtonClass} mt-2`}
                onClick={() => {
                  const trade = trades.find(
                    (candidate) => candidate.code === item.code && candidate.exitPrice === null,
                  )
                  if (trade) void updateTrade(trade.id, { stopPrice: item.raiseTo })
                }}
              >
                訂正したので記録する
              </button>
            </div>
          )}
        </div>
      ))}

      {/* 落ちた理由 */}
      {plan.skipped.length > 0 && (
        <div className="mt-1">
          <button
            type="button"
            className="text-sm text-neutral-600 underline underline-offset-2 dark:text-neutral-300"
            onClick={() => setShowSkipped(!showSkipped)}
          >
            見送った銘柄 {plan.skipped.length}件{showSkipped ? 'を隠す' : 'を見る'}
          </button>
          {showSkipped && (
            <ul className="mt-2 space-y-1 text-sm text-neutral-600 dark:text-neutral-300">
              {plan.skipped.map((item) => (
                <li key={item.code}>
                  <span className="font-medium">
                    {item.code} {item.name}
                  </span>
                  ：{item.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
        建玉と注文を合わせた想定損失 {yen(plan.totalRisk)}（資金の{riskPercent.toFixed(2)}%）。
        新規は週1銘柄まで、合計は資金の3%までにしています。
      </p>
    </Card>
  )
}
