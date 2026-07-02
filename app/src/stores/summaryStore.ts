import { create } from 'zustand'
import { db, type Summary } from '../lib/db'

interface SummaryState {
  current: Summary | null
  load: (recordingId: string) => Promise<void>
  save: (summary: Summary) => Promise<void>
}

export const useSummaryStore = create<SummaryState>((set) => ({
  current: null,

  load: async (recordingId) => {
    const summary = await db.summaries.get(recordingId)
    set({ current: summary ?? null })
  },

  save: async (summary) => {
    await db.summaries.put(summary)
    set({ current: summary })
  },
}))
