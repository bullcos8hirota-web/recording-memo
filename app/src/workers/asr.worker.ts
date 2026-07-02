import { pipeline, type AutomaticSpeechRecognitionPipeline, type ProgressInfo } from '@huggingface/transformers'
import { ASR_LANGUAGE, ASR_MODEL_ID } from '../lib/asr/config'
import type { TranscriptSegment } from '../lib/db/schema'

const WHISPER_SAMPLE_RATE = 16000
/** Whisper's native context window is 30s; only chunk longer recordings. */
const LONG_FORM_THRESHOLD_S = 30

export interface AsrRequest {
  type: 'transcribe'
  recordingId: string
  audio: Float32Array
}

export type AsrResponse =
  | { type: 'model-progress'; recordingId: string; progress: number }
  | { type: 'model-ready'; recordingId: string }
  | { type: 'result'; recordingId: string; segments: TranscriptSegment[]; fullText: string }
  | { type: 'error'; recordingId: string; message: string }

let transcriberPromise: Promise<AutomaticSpeechRecognitionPipeline> | null = null

function getTranscriber(recordingId: string): Promise<AutomaticSpeechRecognitionPipeline> {
  if (!transcriberPromise) {
    transcriberPromise = pipeline('automatic-speech-recognition', ASR_MODEL_ID, {
      device: 'auto',
      progress_callback: (info: ProgressInfo) => {
        if (info.status === 'progress_total') {
          post({ type: 'model-progress', recordingId, progress: info.progress })
        } else if (info.status === 'ready') {
          post({ type: 'model-ready', recordingId })
        }
      },
    })
  }
  return transcriberPromise
}

function post(message: AsrResponse) {
  self.postMessage(message)
}

self.onmessage = async (event: MessageEvent<AsrRequest>) => {
  const { type, recordingId, audio } = event.data
  if (type !== 'transcribe') return

  try {
    const transcriber = await getTranscriber(recordingId)
    const durationSeconds = audio.length / WHISPER_SAMPLE_RATE
    const chunkingOptions =
      durationSeconds > LONG_FORM_THRESHOLD_S
        ? { chunk_length_s: 30, stride_length_s: 5 }
        : {}

    const output = await transcriber(audio, {
      language: ASR_LANGUAGE,
      task: 'transcribe',
      return_timestamps: true,
      ...chunkingOptions,
    })

    const segments: TranscriptSegment[] = (output.chunks ?? []).map((chunk) => ({
      start: chunk.timestamp[0] ?? 0,
      end: chunk.timestamp[1] ?? chunk.timestamp[0] ?? 0,
      text: chunk.text.trim(),
    }))

    post({
      type: 'result',
      recordingId,
      segments,
      fullText: output.text.trim(),
    })
  } catch (err) {
    post({
      type: 'error',
      recordingId,
      message: err instanceof Error ? err.message : String(err),
    })
  }
}
