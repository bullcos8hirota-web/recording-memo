export type RecordingStatus =
  | 'recorded'
  | 'transcribing'
  | 'summarizing'
  | 'done'
  | 'error'

export interface Recording {
  id: string
  title: string
  createdAt: number
  durationMs: number
  audioBlob: Blob
  tags: string[]
  status: RecordingStatus
  driveUrl?: string
  errorMessage?: string
  processedAt?: number
}

export interface TranscriptSegment {
  start: number
  end: number
  text: string
  speaker?: string
}

export interface Transcript {
  recordingId: string
  segments: TranscriptSegment[]
  fullText: string
  editedAt?: number
}

export interface Summary {
  recordingId: string
  overview: string
  keyPoints: string[]
  decisions: string[]
  actionItems: string[]
  editedAt?: number
}
