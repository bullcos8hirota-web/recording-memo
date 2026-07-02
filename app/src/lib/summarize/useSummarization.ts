import { useCallback, useEffect, useRef, useState } from 'react'
import type { ParsedSummary, SummarizeRequest, SummarizeResponse } from '../../workers/summarize.worker'

export interface SummarizationProgress {
  isRunning: boolean
  modelProgress: number | null
  error: string | null
}

export interface SummarizationResult {
  summary: ParsedSummary
  rawText: string
  parsed: boolean
}

export function useSummarization() {
  const workerRef = useRef<Worker | null>(null)
  const [progress, setProgress] = useState<SummarizationProgress>({
    isRunning: false,
    modelProgress: null,
    error: null,
  })

  const getWorker = useCallback((): Worker => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../../workers/summarize.worker.ts', import.meta.url),
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

  const summarize = useCallback(
    async (recordingId: string, transcriptText: string): Promise<SummarizationResult> => {
      setProgress({ isRunning: true, modelProgress: null, error: null })
      try {
        const worker = getWorker()

        const result = await new Promise<SummarizationResult>((resolve, reject) => {
          const handleMessage = (event: MessageEvent<SummarizeResponse>) => {
            const msg = event.data
            if (msg.recordingId !== recordingId) return
            if (msg.type === 'model-progress') {
              setProgress((p) => ({ ...p, modelProgress: msg.progress }))
            } else if (msg.type === 'model-ready') {
              setProgress((p) => ({ ...p, modelProgress: 100 }))
            } else if (msg.type === 'result') {
              worker.removeEventListener('message', handleMessage)
              resolve({ summary: msg.summary, rawText: msg.rawText, parsed: msg.parsed })
            } else if (msg.type === 'error') {
              worker.removeEventListener('message', handleMessage)
              reject(new Error(msg.message))
            }
          }
          worker.addEventListener('message', handleMessage)
          const request: SummarizeRequest = { type: 'summarize', recordingId, transcriptText }
          worker.postMessage(request)
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

  return { summarize, progress }
}
