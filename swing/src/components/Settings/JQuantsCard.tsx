import { useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { daysAgo, fetchDailyBars, fetchMaster } from '../../lib/market/jquants'
import { shortCode } from '../../lib/plan/screener'
import { shortDate } from '../../lib/format'
import { Card, inputClass, subtleButtonClass } from '../ui/Primitives'

/**
 * J-Quants(日本取引所グループのデータ配信)のAPIキーを預かる。
 * キーは端末の中にだけ置き、「状態をコピー」の文章にも入れない。
 */
export function JQuantsCard() {
  const settings = useAppStore((s) => s.settings)
  const saveSettings = useAppStore((s) => s.saveSettings)
  const stocks = useAppStore((s) => s.stocks)
  const updateStock = useAppStore((s) => s.updateStock)
  const [naming, setNaming] = useState(false)
  const [input, setInput] = useState(settings.jquantsApiKey ?? '')
  const [reveal, setReveal] = useState(false)
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const saved = settings.jquantsApiKey ?? ''
  const dirty = input.trim() !== saved

  const check = async () => {
    setChecking(true)
    setResult(null)
    try {
      // 動いているかを見るだけなので、1銘柄・2週間だけ取る。
      const bars = await fetchDailyBars({
        apiKey: input.trim(),
        code: '7203',
        from: daysAgo(14),
        to: daysAgo(0),
      })
      const last = bars[bars.length - 1]
      setResult({
        ok: true,
        text: `つながりました。トヨタの${shortDate(last.date)}の終値は ${last.close.toLocaleString('ja-JP')}円です。`,
      })
    } catch (error) {
      setResult({ ok: false, text: error instanceof Error ? error.message : String(error) })
    } finally {
      setChecking(false)
    }
  }

  // 登録済みの銘柄に、正式な会社名と業種を入れる。手入力の揺れや誤字もここで直る。
  const fillNames = async () => {
    setNaming(true)
    setResult(null)
    try {
      const master = new Map(
        (await fetchMaster({ apiKey: saved })).map((row) => [shortCode(row.code), row]),
      )
      let updated = 0
      for (const stock of stocks) {
        const info = master.get(shortCode(stock.code))
        if (!info) continue
        if (stock.name === info.name && stock.sector === info.sector) continue
        await updateStock(stock.code, { name: info.name, sector: info.sector })
        updated += 1
      }
      setResult({ ok: true, text: `${updated}銘柄の会社名と業種を入れました。` })
    } catch (error) {
      setResult({ ok: false, text: error instanceof Error ? error.message : String(error) })
    } finally {
      setNaming(false)
    }
  }

  return (
    <Card
      title="J-Quants(株価の自動取得)"
      description="APIキーを入れておくと、監視タブの「全銘柄を更新」で日足をまとめて取り込めます。貼り付けでの取り込みも今までどおり使えます。"
    >
      <label className="block text-sm font-medium">
        APIキー
        <input
          className={`${inputClass} mt-1`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          type={reveal ? 'text' : 'password'}
          autoComplete="off"
          spellCheck={false}
          placeholder="J-Quantsのダッシュボード → 設定 → APIキー"
        />
      </label>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className={subtleButtonClass}
          onClick={() => void saveSettings({ jquantsApiKey: input.trim() })}
          disabled={!dirty}
        >
          保存
        </button>
        <button
          type="button"
          className={subtleButtonClass}
          onClick={() => void check()}
          disabled={checking || !input.trim()}
        >
          {checking ? '確認中…' : '接続を確認'}
        </button>
        {saved && stocks.length > 0 && (
          <button
            type="button"
            className={subtleButtonClass}
            onClick={() => void fillNames()}
            disabled={naming}
          >
            {naming ? '取得中…' : '会社名と業種を入れる'}
          </button>
        )}
        <button type="button" className={subtleButtonClass} onClick={() => setReveal(!reveal)}>
          {reveal ? '隠す' : '表示'}
        </button>
        {saved && (
          <button
            type="button"
            className={subtleButtonClass}
            onClick={() => {
              setInput('')
              void saveSettings({ jquantsApiKey: '' })
              setResult(null)
            }}
          >
            消す
          </button>
        )}
      </div>

      {dirty && input.trim() !== '' && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
          まだ保存されていません。「保存」を押してください。
        </p>
      )}

      {result && (
        <p
          className={`mt-2 text-sm ${
            result.ok
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-rose-700 dark:text-rose-300'
          }`}
        >
          {result.text}
        </p>
      )}

      <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
        キーはこの端末の中(IndexedDB)にだけ保存します。「状態をコピー」の文章には入りません。
        取得する株価は分割・併合の調整済みなので、分割があっても過去の値が飛びません。
      </p>
    </Card>
  )
}
