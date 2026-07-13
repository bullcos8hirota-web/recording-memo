import { useMemo, useState } from 'react'
import { runGeminiPipeline } from '../../lib/gemini/runGeminiPipeline'
import { getGeminiApiKey } from '../../lib/gemini/settings'
import { type Recording, type Transcript } from '../../lib/db'
import { useAudioRecorder } from '../../lib/audio/useAudioRecorder'
import { useLiveSpeechRecognition } from '../../lib/speech/useLiveSpeechRecognition'
import { buildFallbackSummary } from '../../lib/summarize/fallback'
import { useRecordingStore } from '../../stores/recordingStore'
import { useSummaryStore } from '../../stores/summaryStore'
import { useTranscriptStore } from '../../stores/transcriptStore'
import { Waveform } from './Waveform'

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function statusLabel(status: string, saving: boolean): string {
  if (saving) return '保存中'
  if (status === 'recording') return '録音中'
  if (status === 'paused') return '一時停止中'
  if (status === 'stopped') return '保存しました'
  if (status === 'error') return '確認が必要です'
  return '待機中'
}

function helpText(status: string): string {
  if (status === 'recording') return '録音が終わったら「保存してAI議事録へ」を押します。'
  if (status === 'paused') return '再開するか、このまま保存できます。'
  if (status === 'stopped') {
    return '録音は保存済みです。下の「保存した録音」から議事録や文字起こしを確認できます。'
  }
  return '録音すると自動で保存され、AI接続済みなら文字起こしと議事録化へ進みます。'
}

export function Recorder() {
  const { recorder, state } = useAudioRecorder()
  const speech = useLiveSpeechRecognition()
  const addRecording = useRecordingStore((s) => s.add)
  const updateRecording = useRecordingStore((s) => s.update)
  const loadRecordings = useRecordingStore((s) => s.loadAll)
  const saveTranscript = useTranscriptStore((s) => s.save)
  const saveSummary = useSummaryStore((s) => s.save)
  const [saving, setSaving] = useState(false)

  const liveText = useMemo(() => {
    return `${speech.state.text}${speech.state.interimText ? ` ${speech.state.interimText}` : ''}`.trim()
  }, [speech.state.interimText, speech.state.text])

  const handleStart = async () => {
    speech.reset()
    const started = await recorder.start()
    if (started) speech.start()
  }

  const handleStop = async () => {
    setSaving(true)
    try {
      const speechStop = speech.stop()
      const audioStop = recorder.stop()
      await speechStop
      const { blob, durationMs } = await audioStop
      const id = crypto.randomUUID()
      const speechSnapshot = speech.getSnapshot()
      const fullText = speechSnapshot.text.trim()
      const transcript: Transcript = {
        recordingId: id,
        segments: speechSnapshot.segments,
        fullText,
      }
      const hasGeminiKey = Boolean(getGeminiApiKey())
      const recording: Recording = {
        id,
        title: `録音 ${new Date().toLocaleString('ja-JP')}`,
        createdAt: Date.now(),
        durationMs,
        audioBlob: blob,
        tags: fullText ? ['端末文字起こし'] : ['音声のみ'],
        status: hasGeminiKey ? 'transcribing' : 'done',
      }

      await addRecording(recording)
      await saveTranscript(transcript)
      await saveSummary(buildFallbackSummary(id, fullText))

      if (hasGeminiKey) {
        void runGeminiPipeline(recording, { liveTranscript: transcript })
          .catch((error) => {
            const message = error instanceof Error ? error.message : String(error)
            return updateRecording(id, { status: 'error', errorMessage: message })
          })
          .finally(() => {
            void loadRecordings()
          })
      }
    } finally {
      setSaving(false)
    }
  }

  const canStart =
    state.status === 'idle' || state.status === 'stopped' || state.status === 'error'

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {statusLabel(state.status, saving)}
          </p>
          <span className="mt-1 block font-mono text-5xl font-semibold tabular-nums">
            {formatElapsed(state.elapsedMs)}
          </span>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            {helpText(state.status)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          {canStart && (
            <button
              type="button"
              onClick={handleStart}
              className="col-span-2 min-h-14 rounded bg-red-600 px-6 py-4 text-lg font-semibold text-white hover:bg-red-700 sm:col-span-1"
            >
              録音開始
            </button>
          )}
          {state.status === 'recording' && (
            <>
              <button
                type="button"
                onClick={() => {
                  recorder.pause()
                  void speech.stop()
                }}
                className="min-h-12 rounded bg-neutral-600 px-4 py-3 text-base font-semibold text-white hover:bg-neutral-700"
              >
                一時停止
              </button>
              <button
                type="button"
                onClick={handleStop}
                disabled={saving}
                className="min-h-12 rounded bg-neutral-900 px-4 py-3 text-base font-semibold text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
              >
                保存してAI議事録へ
              </button>
            </>
          )}
          {state.status === 'paused' && (
            <>
              <button
                type="button"
                onClick={() => {
                  recorder.resume()
                  speech.start()
                }}
                className="min-h-12 rounded bg-red-600 px-4 py-3 text-base font-semibold text-white hover:bg-red-700"
              >
                再開
              </button>
              <button
                type="button"
                onClick={handleStop}
                disabled={saving}
                className="min-h-12 rounded bg-neutral-900 px-4 py-3 text-base font-semibold text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
              >
                保存してAI議事録へ
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-4">
        <Waveform analyser={recorder.analyser} active={state.status === 'recording'} />
      </div>

      {state.status === 'recording' && (
        <div className="mt-4 rounded border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            ライブ文字起こし
          </p>
          <p className="mt-1 min-h-6 text-sm text-neutral-700 dark:text-neutral-200">
            {liveText || '対応ブラウザでは、話した内容がここに入ります。'}
          </p>
        </div>
      )}

      {speech.state.error && (
        <p className="mt-3 text-sm text-amber-600">{speech.state.error}</p>
      )}
      {state.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
    </section>
  )
}
