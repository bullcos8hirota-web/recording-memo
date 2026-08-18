import { create } from 'zustand'
import { db, DEFAULT_SETTINGS, type PriceSeries, type Settings } from '../lib/db'
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
  /** IndexedDBが使えない環境(プライベートブラウズなど)ではメモリ上だけで動かす。 */
  storageError: boolean
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

/**
 * 保存に失敗しても操作は続けられるようにする。iOSのプライベートブラウズなど、
 * IndexedDBが使えない環境で真っ白になるのを避けるため。
 */
async function persist(
  task: () => Promise<unknown>,
  onError: () => void,
): Promise<void> {
  try {
    // task() の呼び出し自体が同期的に投げることがある。
    await Promise.resolve().then(task)
  } catch (error) {
    console.warn('保存に失敗しました', error)
    onError()
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  storageError: false,
  settings: DEFAULT_SETTINGS,
  stocks: [],
  series: {},
  trades: [],
  selectedCode: null,

  async load() {
    // 1つでも失敗したら保存領域が使えないとみなす。Promise.all だと残りの
    // 拒否が未処理として残るため allSettled で受ける。
    let results
    try {
      // 呼び出した時点で例外が飛ぶ環境もあるので、組み立てごと try で囲む。
      results = await Promise.allSettled([
        db.settings.get('app'),
        db.stocks.orderBy('createdAt').toArray(),
        db.series.toArray(),
        db.trades.toArray(),
      ])
    } catch (error) {
      console.warn('保存領域を開けませんでした', error)
      set({ ready: true, storageError: true })
      return
    }
    if (results.some((result) => result.status === 'rejected')) {
      console.warn('保存領域を読み込めませんでした')
      set({ ready: true, storageError: true })
      return
    }
    const [settings, stocks, seriesRows, trades] = [
      (results[0] as PromiseFulfilledResult<Settings | undefined>).value,
      (results[1] as PromiseFulfilledResult<Stock[]>).value,
      (results[2] as PromiseFulfilledResult<PriceSeries[]>).value,
      (results[3] as PromiseFulfilledResult<Trade[]>).value,
    ]
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
    await persist(() => db.settings.put(next), () => set({ storageError: true }))
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
    await persist(() => db.stocks.put(stock), () => set({ storageError: true }))
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
    await persist(() => db.stocks.put(next), () => set({ storageError: true }))
    set({ stocks: get().stocks.map((s) => (s.code === code ? next : s)) })
  },

  async removeStock(code) {
    await persist(
      () =>
        db.transaction('rw', db.stocks, db.series, async () => {
          await db.stocks.delete(code)
          await db.series.delete(code)
        }),
      () => set({ storageError: true }),
    )
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
    await persist(
      () => db.series.put({ code: normalized, bars: merged, updatedAt: Date.now() }),
      () => set({ storageError: true }),
    )
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
    await persist(() => db.trades.put(trade), () => set({ storageError: true }))
    set({ trades: [...get().trades, trade] })
    return trade
  },

  async updateTrade(id, patch) {
    const trade = get().trades.find((t) => t.id === id)
    if (!trade) return
    const next = { ...trade, ...patch, id, updatedAt: Date.now() }
    await persist(() => db.trades.put(next), () => set({ storageError: true }))
    set({ trades: get().trades.map((t) => (t.id === id ? next : t)) })
  },

  async removeTrade(id) {
    await persist(() => db.trades.delete(id), () => set({ storageError: true }))
    set({ trades: get().trades.filter((t) => t.id !== id) })
  },

  async loadSample() {
    const samples = buildSampleData()
    await db.transaction('rw', db.stocks, db.series, async () => {
      for (const { stock, bars } of samples) {
        await persist(() => db.stocks.put(stock), () => set({ storageError: true }))
        await db.series.put({ code: stock.code, bars, updatedAt: Date.now() })
      }
    })
    await get().load()
    set({ selectedCode: samples[0]?.stock.code ?? null })
  },

  async clearSample() {
    await persist(
      () =>
        db.transaction('rw', db.stocks, db.series, async () => {
          for (const code of SAMPLE_CODES) {
            await db.stocks.delete(code)
            await db.series.delete(code)
          }
        }),
      () => set({ storageError: true }),
    )
    const series = { ...get().series }
    for (const code of SAMPLE_CODES) delete series[code]
    set({ stocks: get().stocks.filter((s) => !SAMPLE_CODES.includes(s.code)), series })
  },
}))
