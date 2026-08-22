import { useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { analyzePaste } from '../../lib/market/importPaste'
import {
  matchExecutions,
  parseTradeHistoryCsv,
  readCsvFile,
  type MatchedTrade,
} from '../../lib/market/csv'
import { readClipboard } from '../../lib/clipboard'
import type { Bar } from '../../lib/market/types'
import { price, shortDate, today } from '../../lib/format'
import { buttonClass, Card, Field, inputClass, subtleButtonClass } from '../ui/Primitives'

export function ImportView() {
  return (
    <div className="space-y-4">
      <PriceImport />
      <HistoryImport />
      <SampleData />
    </div>
  )
}

/**
 * 株価の取り込み口。貼り付けた中身から、1銘柄の時系列か、その日の複数銘柄の値かを
 * 判断する。入口を分けると使う側が迷うので、1つにまとめている。
 */
function PriceImport() {
  const stocks = useAppStore((s) => s.stocks)
  const addStock = useAppStore((s) => s.addStock)
  const importBars = useAppStore((s) => s.importBars)
  const selectedCode = useAppStore((s) => s.selectedCode)

  const [text, setText] = useState('')
  const [code, setCode] = useState(selectedCode ?? '')
  const [name, setName] = useState('')
  const [date, setDate] = useState(today())
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const result = analyzePaste(text, stocks, date)
  const known = new Set(stocks.map((stock) => stock.code.toUpperCase()))
  const target = code.trim().toUpperCase()

  const quotesReady =
    result.kind === 'quotes'
      ? result.rows.filter((row) => row.bar !== null && row.code !== null && known.has(row.code))
      : []

  const canImport =
    (result.kind === 'series' && target !== '') || (result.kind === 'quotes' && quotesReady.length > 0)

  const paste = async () => {
    const clip = await readClipboard()
    if (clip.ok) {
      setText(clip.text)
      setError(null)
      setMessage(null)
    } else {
      setError(clip.reason)
    }
  }

  const run = async () => {
    setError(null)
    setMessage(null)

    if (result.kind === 'series') {
      if (!target) {
        setError('どの銘柄のデータか、銘柄コードを入れてください。')
        return
      }
      if (!known.has(target)) await addStock({ code: target, name: name || target })
      const total = await importBars(target, result.bars)
      const first = result.bars[0].date
      const last = result.bars[result.bars.length - 1].date
      setMessage(
        `${target}に${result.bars.length}本を取り込みました(${shortDate(first)}〜${shortDate(last)})。保存済みは合計${total}本。`,
      )
      setText('')
      return
    }

    if (result.kind === 'quotes') {
      for (const row of quotesReady) {
        await importBars(row.code!, [row.bar!])
      }
      setMessage(`${quotesReady.length}銘柄の${shortDate(date)}の値を更新しました。`)
      setText('')
    }
  }

  return (
    <Card
      title="株価を取り込む"
      description="時系列の表でも、「コード 株価」の行でも、そのまま貼り付ければ読み分けます。分割して貼っても構いません。"
    >
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} onClick={() => void paste()}>
          クリップボードから貼り付け
        </button>
        <label className={`${subtleButtonClass} cursor-pointer`}>
          CSVファイル
          <input
            type="file"
            accept=".csv,.txt,text/csv"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (!file) return
              setText(await readCsvFile(file))
              event.target.value = ''
            }}
          />
        </label>
      </div>

      <div className="mt-3">
        <Field label="貼り付け">
          <textarea
            className={`${inputClass} min-h-32 font-mono text-sm`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'26/8/21\t1,410\t1,430\t1,405\t1,425\n\nまたは\n\n4828 1425\n9768 3740'}
          />
        </Field>
      </div>

      {result.kind === 'series' && (
        <div className="mt-3 space-y-3">
          <div className="rounded-xl bg-neutral-50 px-3 py-2 text-sm dark:bg-neutral-800/60">
            <p className="font-medium">
              日付入りのデータとして読みました（{result.bars.length}本 /{' '}
              {shortDate(result.bars[0].date)}〜{shortDate(result.bars[result.bars.length - 1].date)}）
            </p>
            <p className="mt-1 text-neutral-500 dark:text-neutral-400">
              終値 {price(result.bars[result.bars.length - 1].close)}円
              {result.skipped > 0 && ` / 読めなかった行 ${result.skipped}`}
            </p>
            <VolumeCheck bars={result.bars} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="銘柄コード" hint="このデータを入れる銘柄">
              <input
                className={inputClass}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="4828"
                list="stock-codes"
              />
              <datalist id="stock-codes">
                {stocks.map((stock) => (
                  <option key={stock.code} value={stock.code}>
                    {stock.name}
                  </option>
                ))}
              </datalist>
            </Field>
            {!known.has(target) && target !== '' && (
              <Field label="銘柄名" hint="新しい銘柄として登録します">
                <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
            )}
          </div>
        </div>
      )}

      {result.kind === 'quotes' && (
        <div className="mt-3 space-y-3">
          <Field label="この日の値として取り込みます">
            <input
              type="date"
              className={inputClass}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {result.rows.map((row, index) => (
                  <tr key={`${row.raw}-${index}`}>
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs text-neutral-500">{row.code ?? '—'}</span>{' '}
                      {row.name ?? ''}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.bar ? `${price(row.bar.close)}円` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-neutral-500">
                      {row.error
                        ? row.error
                        : row.code && !known.has(row.code)
                          ? '未登録'
                          : '更新できます'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result.kind === 'empty' && result.reason && (
        <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{result.reason}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className={buttonClass} disabled={!canImport} onClick={() => void run()}>
          {result.kind === 'quotes' && quotesReady.length > 0
            ? `${quotesReady.length}銘柄を更新`
            : '取り込む'}
        </button>
        {message && <span className="text-sm text-neutral-600 dark:text-neutral-300">{message}</span>}
        {error && <span className="text-sm text-rose-600 dark:text-rose-400">{error}</span>}
      </div>
    </Card>
  )
}

/**
 * 出来高が読めているかは、取り込んだ後だと分かりにくい。貼った時点で見えるようにする。
 * 読めていれば、この銘柄の出来高判定(20日平均との比較)が効く。
 */
function VolumeCheck({ bars }: { bars: Bar[] }) {
  const withVolume = bars.filter((bar) => bar.volume > 0).length
  const last = bars[bars.length - 1]

  return (
    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
      出来高が読めた行 {withVolume}/{bars.length}
      {withVolume === 0 && '（出来高の列を含めて貼ると、出来高もあわせて見られます）'}
      <br />
      最新 {shortDate(last.date)}: 始値{price(last.open)} 高値{price(last.high)} 安値
      {price(last.low)} 終値{price(last.close)} 出来高
      {last.volume > 0 ? last.volume.toLocaleString('ja-JP') : '—'}
    </p>
  )
}

function HistoryImport() {
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

function SampleData() {
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
