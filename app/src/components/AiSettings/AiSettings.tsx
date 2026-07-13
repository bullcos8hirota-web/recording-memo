import { useEffect, useState } from 'react'
import {
  AVAILABLE_MODELS,
  getGeminiApiKey,
  getGeminiModel,
  getMonthlyBudgetUsd,
  saveGeminiApiKey,
  saveGeminiModel,
  saveMonthlyBudgetUsd,
  subscribeToGeminiSettingsChange,
  type GeminiModel,
} from '../../lib/gemini/settings'
import { getBudgetStatus } from '../../lib/gemini/usage'

const MODEL_LABEL: Record<GeminiModel, string> = {
  'gemini-2.5-flash-lite': 'Flash Lite(最安・おすすめ)',
  'gemini-2.5-flash': 'Flash(高精度・やや高め)',
}

function formatUsd(value: number): string {
  return `$${value.toFixed(value < 0.01 && value > 0 ? 4 : 2)}`
}

export function AiSettings() {
  const [open, setOpen] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState<GeminiModel>(getGeminiModel())
  const [budget, setBudget] = useState(getMonthlyBudgetUsd())
  const [connected, setConnected] = useState(Boolean(getGeminiApiKey()))
  const [usage, setUsage] = useState(getBudgetStatus())
  const [saved, setSaved] = useState(false)

  const refresh = () => {
    setApiKey(getGeminiApiKey())
    setModel(getGeminiModel())
    setBudget(getMonthlyBudgetUsd())
    setConnected(Boolean(getGeminiApiKey()))
    setUsage(getBudgetStatus())
  }

  useEffect(() => {
    refresh()
    return subscribeToGeminiSettingsChange(refresh)
  }, [])

  const handleSave = () => {
    saveGeminiApiKey(apiKey)
    saveGeminiModel(model)
    saveMonthlyBudgetUsd(budget)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }

  const handleDisconnect = () => {
    setApiKey('')
    saveGeminiApiKey('')
  }

  return (
    <section className="mb-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">本気AI(Gemini)</p>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {connected
              ? '録音するとGeminiで自動的に文字起こし・議事録化します。'
              : '今は端末内で軽く整理します。APIキーを入れると本気AIに切り替わります。'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              connected
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200'
                : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
            }`}
          >
            {connected ? 'AI接続済み' : '未接続'}
          </span>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            設定
          </button>
        </div>
      </div>

      {connected && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded border border-neutral-200 px-3 py-2 dark:border-neutral-800">
            <p className="text-xs text-neutral-500">今月の目安</p>
            <p className="font-medium">{formatUsd(usage.usage.estimatedUsd)}</p>
          </div>
          <div className="rounded border border-neutral-200 px-3 py-2 dark:border-neutral-800">
            <p className="text-xs text-neutral-500">月の上限</p>
            <p className="font-medium">{formatUsd(usage.limitUsd)}</p>
          </div>
        </div>
      )}

      {open && (
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Gemini APIキー</span>
            <input
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              type="password"
              autoComplete="off"
              placeholder="Google AI StudioのAPIキー"
              className="w-full rounded border border-neutral-300 bg-white px-3 py-2 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-950"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">モデル</span>
            <select
              value={model}
              onChange={(event) => setModel(event.target.value as GeminiModel)}
              className="w-full rounded border border-neutral-300 bg-white px-3 py-2 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-950"
            >
              {AVAILABLE_MODELS.map((value) => (
                <option key={value} value={value}>
                  {MODEL_LABEL[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">月の利用上限(目安・USD)</span>
            <input
              value={budget}
              onChange={(event) => setBudget(Number(event.target.value))}
              type="number"
              min={0}
              step={0.5}
              inputMode="decimal"
              className="w-full rounded border border-neutral-300 bg-white px-3 py-2 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-950"
            />
            <span className="text-xs text-neutral-500">目安: $1 ≈ 150円。この端末側での概算で、上限に達すると自動整理に切り替わります。</span>
          </label>
          <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            APIキーはこの端末のブラウザにだけ保存され、外部サーバーには送信されません(Geminiへの直接送信のみ)。
            他人にこの端末を貸す場合は、Google Cloud Console側でこのキーの利用範囲・レート制限をかけておくと安心です。
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900"
            >
              保存
            </button>
            {saved && <span className="self-center text-sm text-emerald-600">保存しました</span>}
            <button
              type="button"
              onClick={handleDisconnect}
              className="rounded border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              解除
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
