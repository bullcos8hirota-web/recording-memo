import { create } from 'zustand'
import { db, DEFAULT_SETTINGS, type Settings } from '../lib/db'
import type { Bar, Stock } from '../lib/market/types'
import type { Trade } from '../lib/money/trade'
import { buildSampleData, SAMPLE_CODES } from '../lib/market/sampleData'

/** 日付でマージして昇順に並べ替える。同じ日付は新しい方で上書きする。 */
export function mergeBars(current: Bar[], incoming: Bar[]): Bar[] {
  const map = new Map(current.map((bar) => [bar.date, bar]))
  for (const bar of incoming) map.set(bar.date, bar)
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}

const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`

type AppState = {
  ready: boolean
  settings: Settings
  stocks: Stock[]
  series: Record<string, Bar[]>
  trades: Trade[]
  selectedCode: string | null
  load: () => Promise<void>
  select: (code: string | null) => void
  saveSettings: (patch: Partial<Settings>) => Promise<void>
  addStock: (input: { code: string; name: string; lot?: number; memo?: string }) => Promise<void>
  updateStock: (code: string, patch: Partial<Stock>) => Promise<void>
  removeStock: (code: string) => Promise<void>
  importBars: (code: string, bars: Bar[]) => Promise<number>
  addTrade: (input: Partial<Trade> & { code: string; entryDate: string; entryPrice: number; shares: number }) => Promise<Trade>
  updateTrade: (id: string, patch: Partial<Trade>) => Promise<void>
  removeTrade: (id: string) => Promise<void>
  loadSample: () => Promise<void>
  clearSample: () => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  settings: DEFAULT_SETTINGS,
  stocks: [],
  series: {},
  trades: [],
  selectedCode: null,

  async load() {
    const [settings, stocks, seriesRows, trades] = await Promise.all([
      db.settings.get('app'),
      db.stocks.orderBy('createdAt').toArray(),
      db.series.toArray(),
      db.trades.toArray(),
    ])
    const series: Record<string, Bar[]> = {}
    for (const row of seriesRows) series[row.code] = row.bars
    set({
      ready: true,
      settings: settings ? { ...DEFAULT_SETTINGS, ...settings } : DEFAULT_SETTINGS,
      stocks,
      series,
      trades,
      selectedCode: get().selectedCode ?? stocks[0]?.code ?? null,
    })
  },

  select(code) {
    set({ selectedCode: code })
  },

  async saveSettings(patch) {
    const next = { ...get().settings, ...patch, id: 'app' as const, updatedAt: Date.now() }
    await db.settings.put(next)
    set({ settings: next })
  },

  async addStock({ code, name, lot, memo }) {
    const normalized = code.trim().toUpperCase()
    if (!normalized) return
    const existing = get().stocks.find((s) => s.code === normalized)
    const stock: Stock = {
      code: normalized,
      name: name.trim() || normalized,
      lot: lot ?? existing?.lot ?? get().settings.defaultLot,
      memo: memo ?? existing?.memo,
      demo: existing?.demo,
      createdAt: existing?.createdAt ?? Date.now(),
    }
    await db.stocks.put(stock)
    set({
      stocks: existing
        ? get().stocks.map((s) => (s.code === normalized ? stock : s))
        : [...get().stocks, stock],
      selectedCode: get().selectedCode ?? normalized,
    })
  },

  async updateStock(code, patch) {
    const stock = get().stocks.find((s) => s.code === code)
    if (!stock) return
    const next = { ...stock, ...patch, code }
    await db.stocks.put(next)
    set({ stocks: get().stocks.map((s) => (s.code === code ? next : s)) })
  },

  async removeStock(code) {
    await db.transaction('rw', db.stocks, db.series, async () => {
      await db.stocks.delete(code)
      await db.series.delete(code)
    })
    const series = { ...get().series }
    delete series[code]
    const stocks = get().stocks.filter((s) => s.code !== code)
    set({
      stocks,
      series,
      selectedCode: get().selectedCode === code ? (stocks[0]?.code ?? null) : get().selectedCode,
    })
  },

  async importBars(code, bars) {
    const normalized = code.trim().toUpperCase()
    const merged = mergeBars(get().series[normalized] ?? [], bars)
    await db.series.put({ code: normalized, bars: merged, updatedAt: Date.now() })
    set({ series: { ...get().series, [normalized]: merged } })
    return merged.length
  },

  async addTrade(input) {
    const now = Date.now()
    const stock = get().stocks.find((s) => s.code === input.code)
    const trade: Trade = {
      id: input.id ?? newId(),
      code: input.code,
      name: input.name ?? stock?.name ?? input.code,
      side: input.side ?? 'long',
      entryDate: input.entryDate,
      entryPrice: input.entryPrice,
      shares: input.shares,
      stopPrice: input.stopPrice ?? null,
      targetPrice: input.targetPrice ?? null,
      exitDate: input.exitDate ?? null,
      exitPrice: input.exitPrice ?? null,
      fees: input.fees ?? 0,
      reason: input.reason ?? '',
      review: input.review ?? '',
      tags: input.tags ?? [],
      createdAt: now,
      updatedAt: now,
    }
    await db.trades.put(trade)
    set({ trades: [...get().trades, trade] })
    return trade
  },

  async updateTrade(id, patch) {
    const trade = get().trades.find((t) => t.id === id)
    if (!trade) return
    const next = { ...trade, ...patch, id, updatedAt: Date.now() }
    await db.trades.put(next)
    set({ trades: get().trades.map((t) => (t.id === id ? next : t)) })
  },

  async removeTrade(id) {
    await db.trades.delete(id)
    set({ trades: get().trades.filter((t) => t.id !== id) })
  },

  async loadSample() {
    const samples = buildSampleData()
    await db.transaction('rw', db.stocks, db.series, async () => {
      for (const { stock, bars } of samples) {
        await db.stocks.put(stock)
        await db.series.put({ code: stock.code, bars, updatedAt: Date.now() })
      }
    })
    await get().load()
    set({ selectedCode: samples[0]?.stock.code ?? null })
  },

  async clearSample() {
    await db.transaction('rw', db.stocks, db.series, async () => {
      for (const code of SAMPLE_CODES) {
        await db.stocks.delete(code)
        await db.series.delete(code)
      }
    })
    await get().load()
  },
}))
