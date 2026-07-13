import { useCallback, useRef, useState } from 'react'
import type { TranscriptSegment } from '../db/schema'

type BrowserSpeechRecognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition

interface SpeechRecognitionEventLike {
  resultIndex: number
  results: {
    length: number
    [index: number]: {
      isFinal: boolean
      0: { transcript: string }
    }
  }
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

export interface LiveSpeechState {
  supported: boolean
  listening: boolean
  text: string
  interimText: string
  segments: TranscriptSegment[]
  error: string | null
}

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

export function useLiveSpeechRecognition() {
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const stopResolverRef = useRef<(() => void) | null>(null)
  const startedAtRef = useRef(0)
  const finalTextRef = useRef('')
  const segmentsRef = useRef<TranscriptSegment[]>([])
  const [state, setState] = useState<LiveSpeechState>({
    supported: typeof window !== 'undefined' && getSpeechRecognition() !== null,
    listening: false,
    text: '',
    interimText: '',
    segments: [],
    error: null,
  })

  const reset = useCallback(() => {
    finalTextRef.current = ''
    segmentsRef.current = []
    setState((current) => ({
      ...current,
      text: '',
      interimText: '',
      segments: [],
      error: null,
    }))
  }, [])

  const stop = useCallback(async () => {
    const recognition = recognitionRef.current
    if (!recognition) return

    await new Promise<void>((resolve) => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        stopResolverRef.current = null
        resolve()
      }
      stopResolverRef.current = finish
      window.setTimeout(finish, 500)
      try {
        recognition.stop()
      } catch {
        finish()
      }
    })
    if (recognitionRef.current === recognition) recognitionRef.current = null
    setState((current) => ({ ...current, listening: false, interimText: '' }))
  }, [])

  const getSnapshot = useCallback(
    () => ({ text: finalTextRef.current, segments: [...segmentsRef.current] }),
    [],
  )

  const start = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) {
      setState((current) => ({
        ...current,
        supported: false,
        error:
          'このブラウザではライブ文字起こしを使えません。音声は保存できます。',
      }))
      return
    }

    recognitionRef.current?.abort()
    const recognition = new SpeechRecognition()
    recognition.lang = 'ja-JP'
    recognition.continuous = true
    recognition.interimResults = true
    startedAtRef.current = performance.now()

    recognition.onresult = (event) => {
      let interimText = ''
      let appendedFinalText = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const text = result[0].transcript.trim()
        if (!text) continue
        if (result.isFinal) {
          appendedFinalText += `${text}。`
          const now = (performance.now() - startedAtRef.current) / 1000
          segmentsRef.current = [
            ...segmentsRef.current,
            { start: Math.max(0, now - 5), end: now, text },
          ]
        } else {
          interimText += text
        }
      }
      if (appendedFinalText) {
        finalTextRef.current = `${finalTextRef.current}${appendedFinalText}`
      }
      setState((current) => ({
        ...current,
        listening: true,
        text: finalTextRef.current,
        interimText,
        segments: segmentsRef.current,
      }))
    }

    recognition.onerror = (event) => {
      setState((current) => ({
        ...current,
        error:
          event.error === 'not-allowed'
            ? 'マイク権限が必要です。ブラウザの権限を許可してください。'
            : 'ライブ文字起こしが一時停止しました。音声は保存できます。',
      }))
    }

    recognition.onend = () => {
      stopResolverRef.current?.()
      setState((current) => ({ ...current, listening: false, interimText: '' }))
    }

    recognitionRef.current = recognition
    setState((current) => ({ ...current, supported: true, listening: true, error: null }))
    try {
      recognition.start()
    } catch {
      setState((current) => ({
        ...current,
        listening: false,
        error: 'ライブ文字起こしを開始できませんでした。音声は保存できます。',
      }))
    }
  }, [])

  return { state, start, stop, reset, getSnapshot }
}
