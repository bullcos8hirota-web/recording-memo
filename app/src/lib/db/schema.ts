export type RecordingStatus =
  | 'recording'
  | 'recorded'
  | 'transcribing'
  | 'transcribed'
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
