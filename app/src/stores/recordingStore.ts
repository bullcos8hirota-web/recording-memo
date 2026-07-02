import { create } from 'zustand'
import { db, type Recording } from '../lib/db'

interface RecordingState {
  recordings: Recording[]
  isLoading: boolean
  loadAll: () => Promise<void>
  add: (recording: Recording) => Promise<void>
  updateStatus: (id: string, status: Recording['status']) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useRecordingStore = create<RecordingState>((set) => ({
  recordings: [],
  isLoading: false,

  loadAll: async () => {
    set({ isLoading: true })
    const recordings = await db.recordings.orderBy('createdAt').reverse().toArray()
    set({ recordings, isLoading: false })
  },

  add: async (recording) => {
    await db.recordings.add(recording)
    set((state) => ({ recordings: [recording, ...state.recordings] }))
  },

  updateStatus: async (id, status) => {
    await db.recordings.update(id, { status })
    set((state) => ({
      recordings: state.recordings.map((r) =>
        r.id === id ? { ...r, status } : r,
      ),
    }))
  },

  remove: async (id) => {
    await db.recordings.delete(id)
    await db.transcripts.delete(id)
    await db.summaries.delete(id)
    set((state) => ({
      recordings: state.recordings.filter((r) => r.id !== id),
    }))
  },
}))
