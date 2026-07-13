import { create } from 'zustand'
import { db, type Recording } from '../lib/db'

interface RecordingState {
  recordings: Recording[]
  isLoading: boolean
  loadAll: () => Promise<void>
  add: (recording: Recording) => Promise<void>
  update: (id: string, details: Partial<Recording>) => Promise<void>
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

  update: async (id, details) => {
    await db.recordings.update(id, details)
    set((state) => ({
      recordings: state.recordings.map((recording) =>
        recording.id === id ? { ...recording, ...details } : recording,
      ),
    }))
  },

  remove: async (id) => {
    await db.recordings.delete(id)
    await db.transcripts.delete(id)
    await db.summaries.delete(id)
    set((state) => ({
      recordings: state.recordings.filter((recording) => recording.id !== id),
    }))
  },
}))
