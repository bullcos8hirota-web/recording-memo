import { create } from 'zustand'
import { db, type Transcript } from '../lib/db'

interface TranscriptState {
  current: Transcript | null
  activeSegmentIndex: number
  load: (recordingId: string) => Promise<void>
  save: (transcript: Transcript) => Promise<void>
  setActiveSegmentByTime: (seconds: number) => void
}

export const useTranscriptStore = create<TranscriptState>((set, get) => ({
  current: null,
  activeSegmentIndex: -1,

  load: async (recordingId) => {
    const transcript = await db.transcripts.get(recordingId)
    set({ current: transcript ?? null, activeSegmentIndex: -1 })
  },

  save: async (transcript) => {
    await db.transcripts.put(transcript)
    set({ current: transcript })
  },

  setActiveSegmentByTime: (seconds) => {
    const segments = get().current?.segments ?? []
    const index = segments.findIndex(
      (s) => seconds >= s.start && seconds < s.end,
    )
    if (index !== get().activeSegmentIndex) {
      set({ activeSegmentIndex: index })
    }
  },
}))
