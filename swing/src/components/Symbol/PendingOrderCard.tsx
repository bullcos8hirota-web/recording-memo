import { useAppStore } from '../../stores/appStore'
import { price, shortDate, today } from '../../lib/format'
import { subtleButtonClass } from '../ui/Primitives'
import type { Stock } from '../../lib/market/types'

/**
 * 証券会社に出してある注文。アプリは約定を知らないので、出したことを覚えておく。
 * これが無いと、毎日「買う条件が揃っています」と出て、同じ注文を二重に出しかねない。
 */
export function PendingOrderCard({ stock, onFilled }: { stock: Stock; onFilled: () => void }) {
  const updateStock = useAppStore((s) => s.updateStock)
  const order = stock.pendingOrder
  if (!order) return null

  const expired = order.expiresOn < today()
  const clear = () => void updateStock(stock.code, { pendingOrder: null })

  return (
    <div
      className={`mb-3 rounded-xl px-3 py-3 text-sm ${
        expired
          ? 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200'
          : 'bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200'
      }`}
    >
      <p className="font-medium">
        {expired ? '注文の期限が過ぎています' : 'この銘柄は注文中です'}
      </p>
      <p className="mt-1">
        逆指値 {price(order.trigger)}円以上で {order.shares.toLocaleString('ja-JP')}株 / 損切り{' '}
        {price(order.stopPrice)}円 / {shortDate(order.expiresOn)}まで
      </p>
      <p className="mt-1 text-xs">
        {expired
          ? '約定していなければ、証券会社側でも失効しています。消しておいてください。'
          : '同じ銘柄をもう一度買う注文は出さないでください。下の数字は参考です。'}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className={subtleButtonClass} onClick={onFilled}>
          約定した
        </button>
        <button type="button" className={subtleButtonClass} onClick={clear}>
          {expired ? '消す' : '注文を取り消した'}
        </button>
      </div>
    </div>
  )
}
