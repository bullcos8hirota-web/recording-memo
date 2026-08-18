import { useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { parseQuoteLines, type QuoteLine } from '../../lib/market/quickUpdate'
import {
  matchExecutions,
  parsePriceCsv,
  parseTradeHistoryCsv,
  readCsvFile,
  type MatchedTrade,
} from '../../lib/market/csv'
import { price, shortDate, today } from '../../lib/format'
import {
  buttonClass,
  Card,
  Field,
  inputClass,
  subtleButtonClass,
} from '../ui/Primitives'

export function ImportView() {
  return (
    <div className="space-y-4">
      <QuickUpdate />
      <PriceImport />
      <ManualBarForm />
      <HistoryImport />
      <SampleData />
    </div>
  )
}

/**
 * 毎日の更新をいちばん短くするための入口。銘柄ごとにフォームを開かなくても、
 * 画面からコピーした文字列を貼れば、複数銘柄の終値をまとめて更新できる。
 */
function QuickUpdate() {
  const stocks = useAppStore((s) => s.stocks)
  const importBars = useAppStore((s) => s.importBars)
  const [text, setText] = useState('')
  const [date, setDate] = useState(today())
  const [message, setMessage] = useState<string | null>(null)

  const rows: QuoteLine[] = text.trim() ? parseQuoteLines(text, stocks, date) : []
  const known = new Set(stocks.map((stock) => stock.code.toUpperCase()))
  const ready = rows.filter((row) => row.bar !== null && row.code !== null)
  const appliable = ready.filter((row) => known.has(row.code!))

  const apply = async () => {
    for (const row of appliable) {
      await importBars(row.code!, [row.bar!])
    }
    setMessage(`${appliable.length}銘柄の${date}の値を更新しました。`)
    setText('')
  }

  return (
    <Card
      title="まとめて終値を更新"
      description="SBI証券のポートフォリオ画面などをコピーして貼るだけで、登録済みの銘柄をまとめて更新します。毎日の更新はこれがいちばん速いです。"
    >
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <Field label="日付">
          <input
            type="date"
            className={inputClass}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
      </div>
      <Field label="貼り付け" hint="1行に1銘柄。コードか登録済みの銘柄名と、価格が入っていれば読み取ります。">
        <textarea
          className={`${inputClass} min-h-32 font-mono text-sm`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'7203 2850\n9984 9,300\nトヨタ自動車 7203 2,850 +1.2%'}
        />
      </Field>

      {rows.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
              <tr>
                <th className="px-3 py-2">銘柄</th>
                <th className="px-3 py-2 text-right">終値</th>
                <th className="px-3 py-2 text-right">状態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {rows.map((row, index) => {
                const unknown = row.code !== null && !known.has(row.code)
                return (
                  <tr key={`${row.raw}-${index}`}>
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs text-neutral-500">{row.code ?? '—'}</span>{' '}
                      {row.name ?? ''}
                      {row.error && (
                        <span className="block text-xs text-neutral-400">{row.raw}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.bar ? price(row.bar.close) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      {row.error ? (
                        <span className="text-rose-600 dark:text-rose-400">{row.error}</span>
                      ) : unknown ? (
                        <span className="text-neutral-400">未登録なので飛ばします</span>
                      ) : (
                        <span className="text-neutral-500">更新できます</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={buttonClass}
          disabled={appliable.length === 0}
          onClick={() => void apply()}
        >
          {appliable.length > 0 ? `${appliable.length}銘柄を更新` : 'まとめて更新'}
        </button>
        {message && <span className="text-sm text-neutral-600 dark:text-neutral-300">{message}</span>}
      </div>
    </Card>
  )
}

function PriceImport() {
  const stocks = useAppStore((s) => s.stocks)
  const addStock = useAppStore((s) => s.addStock)
  const importBars = useAppStore((s) => s.importBars)
  const selectedCode = useAppStore((s) => s.selectedCode)
  const [code, setCode] = useState(selectedCode ?? '')
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const apply = async (csv: string) => {
    setMessage(null)
    setError(null)
    const target = code.trim().toUpperCase()
    if (!target) {
      setError('銘柄コードを入力してください。')
      return
    }
    const result = parsePriceCsv(csv)
    if (result.error) {
      setError(result.error)
      return
    }
    if (!stocks.some((s) => s.code === target)) {
      await addStock({ code: target, name: name || target })
    }
    const total = await importBars(target, result.rows)
    setMessage(
      `${result.rows.length}本を取り込みました(${shortDate(result.rows[0].date)}〜${shortDate(
        result.rows[result.rows.length - 1].date,
      )})。保存済みは合計${total}本。${result.skipped > 0 ? ` ${result.skipped}行は読めずに飛ばしました。` : ''}`,
    )
    setText('')
  }

  return (
    <Card
      title="株価データを取り込む"
      description="日足のCSVを読み込みます。列は「日付,始値,高値,安値,終値,出来高」。ヘッダー行があれば列名から自動で判別します。"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="銘柄コード">
          <input
            className={inputClass}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="7203"
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
        <Field label="銘柄名(新規登録時のみ)">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="CSVファイル" hint="Shift_JISのファイルもそのまま読めます">
          <input
            type="file"
            accept=".csv,.txt,text/csv"
            className="mt-1 w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-900 file:px-3 file:py-2 file:text-sm file:text-white dark:file:bg-neutral-100 dark:file:text-neutral-900"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (!file) return
              await apply(await readCsvFile(file))
              event.target.value = ''
            }}
          />
        </Field>
      </div>

      <Field label="貼り付けでも取り込めます">
        <textarea
          className={`${inputClass} min-h-28 font-mono text-xs`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'日付,始値,高値,安値,終値,出来高\n2026-08-17,1800,1830,1795,1825,1200000'}
        />
      </Field>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" className={buttonClass} disabled={!text.trim()} onClick={() => void apply(text)}>
          貼り付けた内容を取り込む
        </button>
        {message && <span className="text-sm text-neutral-600 dark:text-neutral-300">{message}</span>}
        {error && <span className="text-sm text-rose-600 dark:text-rose-400">{error}</span>}
      </div>
    </Card>
  )
}

function ManualBarForm() {
  const stocks = useAppStore((s) => s.stocks)
  const importBars = useAppStore((s) => s.importBars)
  const selectedCode = useAppStore((s) => s.selectedCode)
  const [form, setForm] = useState({
    code: selectedCode ?? '',
    date: today(),
    open: '',
    high: '',
    low: '',
    close: '',
    volume: '',
  })
  const [message, setMessage] = useState<string | null>(null)

  const set = (key: keyof typeof form, value: string) => setForm({ ...form, [key]: value })

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const close = Number(form.close)
    if (!form.code || !close) return
    const open = Number(form.open) || close
    await importBars(form.code, [
      {
        date: form.date,
        open,
        high: Number(form.high) || Math.max(open, close),
        low: Number(form.low) || Math.min(open, close),
        close,
        volume: Number(form.volume) || 0,
      },
    ])
    setMessage(`${form.code} の ${form.date} を更新しました。`)
    setForm({ ...form, open: '', high: '', low: '', close: '', volume: '' })
  }

  return (
    <Card title="当日の値を手入力" description="引け後に1本だけ足すときに使います。同じ日付は上書きされます。">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-4">
        <Field label="銘柄">
          <select className={inputClass} value={form.code} onChange={(e) => set('code', e.target.value)}>
            <option value="">選択</option>
            {stocks.map((stock) => (
              <option key={stock.code} value={stock.code}>
                {stock.code} {stock.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="日付">
          <input type="date" className={inputClass} value={form.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="始値">
          <input className={inputClass} value={form.open} onChange={(e) => set('open', e.target.value)} inputMode="decimal" />
        </Field>
        <Field label="高値">
          <input className={inputClass} value={form.high} onChange={(e) => set('high', e.target.value)} inputMode="decimal" />
        </Field>
        <Field label="安値">
          <input className={inputClass} value={form.low} onChange={(e) => set('low', e.target.value)} inputMode="decimal" />
        </Field>
        <Field label="終値">
          <input className={inputClass} value={form.close} onChange={(e) => set('close', e.target.value)} inputMode="decimal" />
        </Field>
        <Field label="出来高">
          <input className={inputClass} value={form.volume} onChange={(e) => set('volume', e.target.value)} inputMode="numeric" />
        </Field>
        <div className="self-end">
          <button type="submit" className={buttonClass}>
            追加する
          </button>
        </div>
      </form>
      {message && <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{message}</p>}
    </Card>
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
      title="SBI証券の取引履歴を取り込む"
      description="SBI証券のサイトで「口座管理 > 取引履歴」を表示し、CSVでダウンロードしたファイルを読み込みます。買いと売りを古い順に突き合わせて1トレードにまとめます。"
    >
      <input
        type="file"
        accept=".csv,.txt,text/csv"
        className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-900 file:px-3 file:py-2 file:text-sm file:text-white dark:file:bg-neutral-100 dark:file:text-neutral-900"
        onChange={async (event) => {
          const file = event.target.files?.[0]
          if (!file) return
          load(await readCsvFile(file))
          event.target.value = ''
        }}
      />
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
                  <th className="px-3 py-2 text-right">状態</th>
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
                    <td className="px-3 py-2 text-right tabular-nums">{row.shares.toLocaleString('ja-JP')}</td>
                    <td className="px-3 py-2 text-right text-xs text-neutral-500">
                      {isDuplicate(row) ? '登録済み' : '新規'}
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
    <Card
      title="サンプルデータ"
      description="実在しない銘柄の架空の値動きです。操作を試すために使ってください。"
    >
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} onClick={() => void loadSample()}>
          サンプルを読み込む
        </button>
        <button type="button" className={subtleButtonClass} disabled={!hasSample} onClick={() => void clearSample()}>
          サンプルを削除
        </button>
      </div>
    </Card>
  )
}
