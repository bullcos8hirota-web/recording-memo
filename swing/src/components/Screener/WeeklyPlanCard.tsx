import { useMemo } from 'react'
import { useAppStore } from '../../stores/appStore'
import { weeklyPlan, type PositionAction } from '../../lib/plan/weekly'
import { comingFriday, price, shortDate, today, yen } from '../../lib/format'
import { Card, Disclosure, subtleButtonClass } from '../ui/Primitives'

/**
 * 「今週やること」。
 *
 * 点数を並べるだけでは、結局どれを買うのか分からない。毎週の判断は決まった手順なので、
 * 落とした理由まで含めてここに出す。何もしない週は、何もしないと書く。
 *
 * 手を動かすものだけを箱で見せ、確認するだけのものは畳む。毎週同じ説明を読ませない。
 */
export function WeeklyPlanCard({ onOpen }: { onOpen: (code: string) => void }) {
  const stocks = useAppStore((s) => s.stocks)
  const series = useAppStore((s) => s.series)
  const trades = useAppStore((s) => s.trades)
  const settings = useAppStore((s) => s.settings)
  const updateStock = useAppStore((s) => s.updateStock)
  const updateTrade = useAppStore((s) => s.updateTrade)

  const plan = useMemo(
    () => weeklyPlan({ stocks, series, trades, settings }),
    [stocks, series, trades, settings],
  )

  // どの日の株価で計算したか。毎週同じ説明文より、この1行のほうが役に立つ。
  const asOf = useMemo(() => {
    const dates = Object.values(series)
      .map((bars) => bars[bars.length - 1]?.date)
      .filter((date): date is string => Boolean(date))
    return dates.length ? dates.sort().at(-1)! : null
  }, [series])

  if (stocks.length === 0) return null

  const riskPercent = settings.capital > 0 ? (plan.totalRisk / settings.capital) * 100 : 0
  const holding = plan.positions.filter((item) => item.kind === 'hold-stop')
  const acting = plan.positions.filter((item) => item.kind !== 'hold-stop')
  const warned = holding.filter((item) => item.warnings.length > 0)
  const quiet = holding.filter((item) => item.warnings.length === 0)

  return (
    <Card
      title="今週やること"
      description={asOf ? `${shortDate(asOf)}の終値で計算しています` : undefined}
    >
      {plan.nothingToDo && (
        <p className="mb-3 rounded-xl bg-slate-100 px-3 py-3 text-sm dark:bg-slate-700/40">
          {plan.pending.length > 0
            ? '新しく出す注文はありません。出してある注文の約定を待ちます。'
            : '今週は何もしません。条件が揃った銘柄が無く、損切りも動かす必要がありません。'}
        </p>
      )}

      {/* 出す注文 */}
      {plan.orders.map((order) => (
        <section
          key={order.code}
          className="mb-3 overflow-hidden rounded-xl border border-emerald-300 dark:border-emerald-800"
        >
          <button
            type="button"
            className="flex w-full items-baseline justify-between gap-2 bg-emerald-100 px-3 py-2.5 text-left dark:bg-emerald-950/60"
            onClick={() => onOpen(order.code)}
          >
            <span className="min-w-0">
              <span className="block text-xs text-emerald-800 dark:text-emerald-300">買う</span>
              <span className="block truncate text-base font-semibold">{order.name}</span>
            </span>
            <span className="shrink-0 text-sm tabular-nums">
              {order.shares.toLocaleString('ja-JP')}株
            </span>
          </button>

          <div className="px-3 py-3 text-sm">
            <dl className="grid grid-cols-[5.5rem_1fr] gap-y-1.5">
              <dt className="text-slate-600 dark:text-slate-300">執行条件</dt>
              <dd className="font-medium">逆指値</dd>
              <dt className="text-slate-600 dark:text-slate-300">条件</dt>
              <dd className="font-medium tabular-nums">{price(order.trigger)}円 以上になったら</dd>
              <dt className="text-slate-600 dark:text-slate-300">価格</dt>
              <dd className="font-medium">成行 ／ 今週中（{shortDate(comingFriday())}まで）</dd>
            </dl>

            <p className="mt-2.5 border-t border-slate-200 pt-2.5 tabular-nums dark:border-slate-700">
              買えたら損切り <span className="font-medium">{price(order.stopPrice)}円</span>
              <span className="mx-1.5 text-slate-400">|</span>
              負けたら <span className="font-medium">−{yen(order.risk)}</span>（
              {((order.risk / settings.capital) * 100).toFixed(2)}%）
            </p>

            {order.earningsUnknown && (
              <div className="mt-2 rounded-lg bg-amber-100 px-2.5 py-2 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                <Disclosure summary="⚠ 決算発表日が未登録です">
                  <p className="text-sm">
                    決算をまたぐと、翌朝に損切り価格を飛び越えて始まることがあります。
                    発注前にSBI証券アプリで次の決算発表日を確認し、2週間以内なら見送ってください。
                  </p>
                </Disclosure>
              </div>
            )}

            <button
              type="button"
              className={`${subtleButtonClass} mt-2.5 w-full`}
              onClick={() =>
                void updateStock(order.code, {
                  pendingOrder: {
                    trigger: order.trigger,
                    shares: order.shares,
                    stopPrice: order.stopPrice,
                    expiresOn: comingFriday(),
                    placedOn: today(),
                    scoreAtOrder: order.score,
                  },
                })
              }
            >
              この内容で注文を出した
            </button>
          </div>
        </section>
      ))}

      {/* 証券会社に出してある注文 */}
      {plan.pending.map((item) => {
        const warn = item.expired || item.alert?.level === 'cancel'
        return (
          <div
            key={item.code}
            className={`mb-3 rounded-xl px-3 py-2.5 text-sm ${
              warn
                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200'
                : 'bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200'
            }`}
          >
            <button
              type="button"
              onClick={() => onOpen(item.code)}
              className="block w-full text-left"
            >
              <span className="font-medium">
                {item.name}：
                {item.expired
                  ? '注文の期限切れ'
                  : item.alert?.level === 'cancel'
                    ? '注文を取り消してください'
                    : '注文中'}
              </span>
              <span className="mt-0.5 block tabular-nums">
                逆指値 {price(item.trigger)}円以上 / {item.shares.toLocaleString('ja-JP')}株 /{' '}
                {shortDate(item.expiresOn)}まで
              </span>
            </button>

            {item.alert && <p className="mt-1.5">{item.alert.message}</p>}

            {(item.expired || item.alert) && (
              <button
                type="button"
                className={`${subtleButtonClass} mt-2 w-full`}
                onClick={() => void updateStock(item.code, { pendingOrder: null })}
              >
                {item.expired ? '消す' : '注文を取り消した'}
              </button>
            )}
          </div>
        )
      })}

      {/* 手当てが要る建玉 */}
      {acting.map((item) => (
        <PositionBox
          key={item.code}
          item={item}
          onOpen={onOpen}
          onRaise={() => {
            const trade = trades.find(
              (candidate) => candidate.code === item.code && candidate.exitPrice === null,
            )
            if (trade && item.raiseTo !== null) void updateTrade(trade.id, { stopPrice: item.raiseTo })
          }}
        />
      ))}

      {/* 決算・権利落ちが近い建玉は畳まない */}
      {warned.map((item) => (
        <div
          key={item.code}
          className="mb-3 rounded-xl bg-amber-100 px-3 py-2.5 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
        >
          <button
            type="button"
            className="text-left font-medium"
            onClick={() => onOpen(item.code)}
          >
            {item.name}：損切り {price(item.stopPrice!)}円 のまま
          </button>
          {item.warnings.map((warning) => (
            <p key={warning} className="mt-0.5">
              {warning}
            </p>
          ))}
        </div>
      ))}

      {/* 動かさない建玉は1行に畳む */}
      {quiet.length > 0 && (
        <div className="border-t border-slate-200 pt-1 dark:border-slate-700">
          <Disclosure
            summary="動かさないもの"
            detail={quiet
              .map((item) => `${item.name} ${price(item.stopPrice!)}円`)
              .join(' ／ ')}
          >
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              {quiet.map((item) => (
                <li key={item.code}>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {item.name}
                  </span>
                  ：{item.note}
                </li>
              ))}
            </ul>
          </Disclosure>
        </div>
      )}

      {/* 落ちた理由 */}
      {plan.skipped.length > 0 && (
        <div className="border-t border-slate-200 dark:border-slate-700">
          <Disclosure summary={`見送り ${plan.skipped.length}件`}>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              {plan.skipped.map((item) => (
                <li key={item.code}>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {item.name}
                  </span>
                  ：{item.reason}
                </li>
              ))}
            </ul>
          </Disclosure>
        </div>
      )}

      <p className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-600 tabular-nums dark:border-slate-700 dark:text-slate-300">
        合計リスク {yen(plan.totalRisk)}（資金の{riskPercent.toFixed(2)}%）／ 新規は週1銘柄・合計3%まで
      </p>
    </Card>
  )
}

function PositionBox({
  item,
  onOpen,
  onRaise,
}: {
  item: PositionAction
  onOpen: (code: string) => void
  onRaise: () => void
}) {
  return (
    <section className="mb-3 overflow-hidden rounded-xl border border-amber-300 dark:border-amber-800">
      <button
        type="button"
        className="flex w-full items-baseline justify-between gap-2 bg-amber-100 px-3 py-2.5 text-left dark:bg-amber-950/60"
        onClick={() => onOpen(item.code)}
      >
        <span className="min-w-0">
          <span className="block text-xs text-amber-800 dark:text-amber-300">
            {item.kind === 'set-stop' ? '損切りを決める' : '損切りを上げる'}
          </span>
          <span className="block truncate text-base font-semibold">{item.name}</span>
        </span>
        {item.raiseTo !== null && (
          <span className="shrink-0 text-sm font-medium tabular-nums">
            {price(item.stopPrice!)} → {price(item.raiseTo)}円
          </span>
        )}
      </button>

      <div className="px-3 py-3 text-sm">
        {item.kind === 'raise-stop' && item.raiseTo !== null ? (
          <>
            <p className="tabular-nums">
              売り注文を訂正：逆指値 <span className="font-medium">{price(item.raiseTo)}円</span>
              <span className="font-medium">以下になったら</span> / 成行 /{' '}
              {item.shares.toLocaleString('ja-JP')}株
            </p>
            <Disclosure summary="なぜ上げるのか">
              <p className="text-sm text-slate-600 dark:text-slate-300">{item.note}</p>
            </Disclosure>
            <button type="button" className={`${subtleButtonClass} mt-1 w-full`} onClick={onRaise}>
              訂正したので記録する
            </button>
          </>
        ) : (
          <p>{item.note}</p>
        )}
        {item.warnings.map((warning) => (
          <p key={warning} className="mt-2 font-medium text-amber-800 dark:text-amber-300">
            {warning}
          </p>
        ))}
      </div>
    </section>
  )
}
