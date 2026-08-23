import { useAppStore } from '../../stores/appStore'
import { earningsAlert, EARNINGS_WARN_DAYS } from '../../lib/market/earnings'
import { shortDate } from '../../lib/format'
import { Card, inputClass, subtleButtonClass } from '../ui/Primitives'
import type { Stock } from '../../lib/market/types'

/**
 * 次回の決算発表日。損切りを置いていても、決算の翌朝はその価格を飛び越えて
 * 始まることがある。チャートからは読めない唯一のリスクなので、日付で管理する。
 */
export function EarningsCard({ stock }: { stock: Stock }) {
  const updateStock = useAppStore((s) => s.updateStock)
  const alert = earningsAlert(stock.earningsDate)

  return (
    <Card title="次回の決算発表日" description="SBI証券アプリの銘柄情報に出ています。">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          className={`${inputClass} w-auto`}
          value={stock.earningsDate ?? ''}
          onChange={(e) => void updateStock(stock.code, { earningsDate: e.target.value || null })}
        />
        {stock.earningsDate && (
          <button
            type="button"
            className={subtleButtonClass}
            onClick={() => void updateStock(stock.code, { earningsDate: null })}
          >
            消す
          </button>
        )}
      </div>

      {alert === null ? (
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          未登録です。決算をまたぐと、損切り価格を飛び越えて下で始まることがあります。
        </p>
      ) : alert.past ? (
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          {shortDate(stock.earningsDate!)}は過ぎています。次回の日付に更新してください。
        </p>
      ) : alert.soon ? (
        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {shortDate(stock.earningsDate!)}まであと{alert.days}日。
          新規に買うなら発表後まで待つか、株数を減らしてください。
        </p>
      ) : (
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          {shortDate(stock.earningsDate!)}まであと{alert.days}日。
          {EARNINGS_WARN_DAYS}日を切ると警告を出します。
        </p>
      )}
    </Card>
  )
}
