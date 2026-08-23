import { useMemo, useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { EMPTY_FUNDAMENTALS, evaluateFundamentals, type Fundamentals } from '../../lib/learn/buffett'
import type { Stock } from '../../lib/market/types'
import { FundamentalsForm } from '../Learn/FundamentalsForm'
import { FundamentalsChecks, FundamentalsSummary } from '../Learn/FundamentalsResult'
import { TermLink } from '../Learn/HelpButton'
import { buttonClass, Card, inputClass, subtleButtonClass } from '../ui/Primitives'
import { shortDate } from '../../lib/format'

/**
 * 銘柄ごとの財務データ(企業カルテ)。チャートは「いつ買うか」、
 * ここは「そもそも買ってよい会社か」を見るための場所。
 */
export function CompanyCard({ stock }: { stock: Stock }) {
  const updateStock = useAppStore((s) => s.updateStock)
  const saved = stock.fundamentals
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Fundamentals>(EMPTY_FUNDAMENTALS)
  const [note, setNote] = useState('')

  const current: Fundamentals = saved ?? EMPTY_FUNDAMENTALS
  const result = useMemo(
    () => evaluateFundamentals(editing ? draft : current),
    [editing, draft, current],
  )

  const startEditing = () => {
    setDraft(saved ?? EMPTY_FUNDAMENTALS)
    setNote(saved?.note ?? '')
    setEditing(true)
  }

  const save = async () => {
    await updateStock(stock.code, {
      fundamentals: { ...draft, note: note.trim() || undefined, updatedAt: Date.now() },
    })
    setEditing(false)
  }

  const clear = async () => {
    if (!confirm(`${stock.name} の財務データを削除しますか?`)) return
    await updateStock(stock.code, { fundamentals: undefined })
    setEditing(false)
  }

  return (
    <Card
      title="企業カルテ"
      description="決算の数字を入れておくと、監視リストで「中身の良い会社」に絞り込めます。"
      actions={
        !editing && (
          <button type="button" className={subtleButtonClass} onClick={startEditing}>
            {saved ? '編集' : '入力する'}
          </button>
        )
      }
    >
      {editing ? (
        <>
          <FundamentalsForm value={draft} onChange={setDraft} />
          <label className="mt-3 block text-sm">
            <span className="text-neutral-600 dark:text-neutral-300">メモ(決算期・出どころなど)</span>
            <input
              className={inputClass}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="2026年3月期 本決算"
            />
          </label>
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            数字の出どころ: PER・PBRは株価ページの参考指標。売上高・営業利益・純利益・自己資本・総資産・
            有利子負債は、SBI証券アプリの銘柄情報(業績・財務)、会社四季報、企業のIRページ(決算短信の1ページ目)。
            金額さえ分かれば、下のボタンで比率に直せます。
          </p>
          <div className="mt-3">
            <FundamentalsSummary result={result} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={buttonClass} onClick={() => void save()}>
              保存
            </button>
            <button type="button" className={subtleButtonClass} onClick={() => setEditing(false)}>
              取消
            </button>
            {saved && (
              <button type="button" className={subtleButtonClass} onClick={() => void clear()}>
                削除
              </button>
            )}
          </div>
        </>
      ) : saved ? (
        <>
          <FundamentalsSummary result={result} />
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            {saved.note ? `${saved.note} / ` : ''}
            {shortDate(new Date(saved.updatedAt).toISOString().slice(0, 10))}に更新
          </p>
          <div className="mt-3">
            <FundamentalsChecks result={result} />
          </div>
        </>
      ) : (
        <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
          まだ入力がありません。<TermLink term="roe">ROE</TermLink>や
          <TermLink term="equity-ratio">自己資本比率</TermLink>
          などを入れておくと、チャートの形だけでなく会社の中身でも銘柄を選べます。
          考え方は「学ぶ」タブのバフェットにまとめています。
        </p>
      )}
    </Card>
  )
}
