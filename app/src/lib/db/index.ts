import Dexie, { type Table } from 'dexie'
import type { Recording, Summary, Transcript } from './schema'

export class AppDatabase extends Dexie {
  recordings!: Table<Recording, string>
  transcripts!: Table<Transcript, string>
  summaries!: Table<Summary, string>

  constructor() {
    super('recording-app')
    this.version(1).stores({
      recordings: 'id, createdAt, status, *tags',
      transcripts: 'recordingId',
      summaries: 'recordingId',
    })
  }
}

export const db = new AppDatabase()

export * from './schema'
