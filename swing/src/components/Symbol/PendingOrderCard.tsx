import { useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { price, shortDate, today } from '../../lib/format'
import { inputClass, subtleButtonClass } from '../ui/Primitives'
import type { Stock } from '../../lib/market/types'

/**
 * 証券会社に出してある注文。アプリは約定を知らないので、出したことを覚えておく。
 * これが無いと、毎日「買う条件が揃っています」と出て、同じ注文を二重に出しかねない。
 */
export function PendingOrderCard({
  stock,
  onFilled,
}: {
  stock: Stock
  onFilled: (fillPrice: number) => void
}) {
  const updateStock = useAppStore((s) => s.updateStock)
  const order = stock.pendingOrder
  const [filling, setFilling] = useState(false)
  const [fillInput, setFillInput] = useState('')
  if (!order) return null

  const expired = order.expiresOn < today()
  const clear = () => void updateStock(stock.code, { pendingOrder: null })
  const fillPrice = Number(fillInput)

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
        逆指値 {price(order.trigger)}円以上で{' '}
        {order.shares.toLocaleString('ja-JP')}株 / 損切り{' '}
        {price(order.stopPrice)}円 / {shortDate(order.expiresOn)}まで
      </p>
      <p className="mt-1 text-xs">
        {expired
          ? '約定していなければ、証券会社側でも失効しています。消しておいてください。'
          : '同じ銘柄をもう一度買う注文は出さないでください。下の数字は参考です。'}
      </p>

      {filling ? (
        // 逆指値は「その価格になったら成行」なので、約定価格は注文価格とずれる。
        // ずれたまま損切りを置くとリスクが変わるので、実際の値をもらって引き直す。
        <div className="mt-3 rounded-lg bg-white/70 p-3 dark:bg-neutral-900/50">
          <label className="block text-xs font-medium">
            実際に約定した価格(円)
            <input
              className={`${inputClass} mt-1`}
              value={fillInput}
              onChange={(e) => setFillInput(e.target.value)}
              inputMode="decimal"
              autoFocus
            />
          </label>
          <p className="mt-1 text-xs">
            SBI証券の「取引履歴」や約定のお知らせに出ている単価です（例{' '}
            {price(order.trigger)}）。
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className={subtleButtonClass}
              disabled={!(fillPrice > 0)}
              onClick={() => onFilled(fillPrice)}
            >
              この価格で損切りを計算
            </button>
            <button
              type="button"
              className={subtleButtonClass}
              onClick={() => setFilling(false)}
            >
              やめる
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className={subtleButtonClass}
            onClick={() => {
              setFillInput(String(order.trigger))
              setFilling(true)
            }}
          >
            約定した
          </button>
          <button type="button" className={subtleButtonClass} onClick={clear}>
            {expired ? '消す' : '注文を取り消した'}
          </button>
        </div>
      )}
    </div>
  )
}
