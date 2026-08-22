import { useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import {
  matchExecutions,
  parseTradeHistoryCsv,
  readCsvFile,
  type MatchedTrade,
} from '../../lib/market/csv'
import { price, shortDate } from '../../lib/format'
import { buttonClass, Card, subtleButtonClass } from '../ui/Primitives'

/**
 * 売買記録の取り込みとサンプルデータ。毎週触るものではないので設定タブに置く。
 */
export function HistoryImportCard() {
  const trades = useAppStore((s) => s.trades)
  const addTrade = useAppStore((s) => s.addTrade)
  const [preview, setPreview] = useState<MatchedTrade[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = (csv: string) => {
    setError(null)
    setMessage(null)
    const result = parseTradeHistoryCsv(csv)
    if (result.error) {
      setError(result.error)
      setPreview([])
      return
    }
    setPreview(matchExecutions(result.rows))
  }

  const isDuplicate = (candidate: MatchedTrade): boolean =>
    trades.some(
      (trade) =>
        trade.code === candidate.code &&
        trade.entryDate === candidate.entryDate &&
        trade.entryPrice === candidate.entryPrice &&
        trade.shares === candidate.shares,
    )

  const save = async () => {
    let added = 0
    for (const candidate of preview) {
      if (isDuplicate(candidate)) continue
      await addTrade({
        code: candidate.code,
        name: candidate.name,
        entryDate: candidate.entryDate,
        entryPrice: candidate.entryPrice,
        shares: candidate.shares,
        exitDate: candidate.exitDate,
        exitPrice: candidate.exitPrice,
        fees: candidate.fees,
        reason: 'SBI証券の取引履歴から取り込み',
      })
      added += 1
    }
    setMessage(`${added}件を記録しました(重複はスキップ)。`)
    setPreview([])
  }

  return (
    <Card
      title="売買の記録を取り込む"
      description="SBI証券の「口座管理 > 取引履歴」からダウンロードしたCSVを読み込みます。買いと売りを古い順に突き合わせて1トレードにまとめます。"
    >
      <label className={`${subtleButtonClass} inline-flex cursor-pointer`}>
        取引履歴CSVを選ぶ
        <input
          type="file"
          accept=".csv,.txt,text/csv"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0]
            if (!file) return
            load(await readCsvFile(file))
            event.target.value = ''
          }}
        />
      </label>
      {error && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      {message && <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{message}</p>}

      {preview.length > 0 && (
        <div className="mt-3">
          <div className="max-h-72 overflow-y-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-neutral-50 text-left text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                <tr>
                  <th className="px-3 py-2">銘柄</th>
                  <th className="px-3 py-2">買い</th>
                  <th className="px-3 py-2">売り</th>
                  <th className="px-3 py-2 text-right">株数</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {preview.map((row, index) => (
                  <tr key={`${row.code}-${row.entryDate}-${index}`}>
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs text-neutral-500">{row.code}</span> {row.name}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {shortDate(row.entryDate)} {price(row.entryPrice)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.exitDate ? `${shortDate(row.exitDate)} ${price(row.exitPrice)}` : '保有中'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.shares.toLocaleString('ja-JP')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" className={buttonClass} onClick={() => void save()}>
              まとめて記録する
            </button>
            <button type="button" className={subtleButtonClass} onClick={() => setPreview([])}>
              取り消す
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}

export function SampleDataCard() {
  const loadSample = useAppStore((s) => s.loadSample)
  const clearSample = useAppStore((s) => s.clearSample)
  const hasSample = useAppStore((s) => s.stocks.some((stock) => stock.demo))

  return (
    <Card title="サンプルデータ" description="実在しない銘柄の架空の値動きです。操作を試すために使います。">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={subtleButtonClass} onClick={() => void loadSample()}>
          読み込む
        </button>
        <button
          type="button"
          className={subtleButtonClass}
          disabled={!hasSample}
          onClick={() => void clearSample()}
        >
          削除
        </button>
      </div>
    </Card>
  )
}
