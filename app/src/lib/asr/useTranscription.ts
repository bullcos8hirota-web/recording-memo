import { useCallback, useEffect, useRef, useState } from 'react'
import { decodeAudioToMono16k } from '../audio/decodeAudio'
import type { TranscriptSegment } from '../db/schema'
import type { AsrRequest, AsrResponse } from '../../workers/asr.worker'

export interface TranscriptionProgress {
  isRunning: boolean
  modelProgress: number | null
  error: string | null
}

export interface TranscriptionResult {
  segments: TranscriptSegment[]
  fullText: string
}

export function useTranscription() {
  const workerRef = useRef<Worker | null>(null)
  const [progress, setProgress] = useState<TranscriptionProgress>({
    isRunning: false,
    modelProgress: null,
    error: null,
  })

  const getWorker = useCallback((): Worker => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../../workers/asr.worker.ts', import.meta.url),
        { type: 'module' },
      )
    }
    return workerRef.current
  }, [])

  useEffect(() => {
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  const transcribe = useCallback(
    async (recordingId: string, audioBlob: Blob): Promise<TranscriptionResult> => {
      setProgress({ isRunning: true, modelProgress: null, error: null })
      try {
        const audio = await decodeAudioToMono16k(audioBlob)
        const worker = getWorker()

        const result = await new Promise<TranscriptionResult>((resolve, reject) => {
          const handleMessage = (event: MessageEvent<AsrResponse>) => {
            const msg = event.data
            if (msg.recordingId !== recordingId) return
            if (msg.type === 'model-progress') {
              setProgress((p) => ({ ...p, modelProgress: msg.progress }))
            } else if (msg.type === 'model-ready') {
              setProgress((p) => ({ ...p, modelProgress: 100 }))
            } else if (msg.type === 'result') {
              worker.removeEventListener('message', handleMessage)
              resolve({ segments: msg.segments, fullText: msg.fullText })
            } else if (msg.type === 'error') {
              worker.removeEventListener('message', handleMessage)
              reject(new Error(msg.message))
            }
          }
          worker.addEventListener('message', handleMessage)
          const request: AsrRequest = { type: 'transcribe', recordingId, audio }
          worker.postMessage(request, [audio.buffer])
        })

        setProgress({ isRunning: false, modelProgress: null, error: null })
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setProgress({ isRunning: false, modelProgress: null, error: message })
        throw err
      }
    },
    [getWorker],
  )

  return { transcribe, progress }
}
