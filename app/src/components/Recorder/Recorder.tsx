import { useState } from 'react'
import { useAudioRecorder } from '../../lib/audio/useAudioRecorder'
import { useRecordingStore } from '../../stores/recordingStore'
import { Waveform } from './Waveform'

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function Recorder() {
  const { recorder, state } = useAudioRecorder()
  const addRecording = useRecordingStore((s) => s.add)
  const [saving, setSaving] = useState(false)

  const handleStop = async () => {
    setSaving(true)
    try {
      const { blob, durationMs } = await recorder.stop()
      await addRecording({
        id: crypto.randomUUID(),
        title: `録音 ${new Date().toLocaleString('ja-JP')}`,
        createdAt: Date.now(),
        durationMs,
        audioBlob: blob,
        tags: [],
        status: 'recorded',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono text-2xl tabular-nums">
          {formatElapsed(state.elapsedMs)}
        </span>
        <div className="flex gap-2">
          {(state.status === 'idle' ||
            state.status === 'stopped' ||
            state.status === 'error') && (
            <button
              type="button"
              onClick={() => recorder.start()}
              className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              録音開始
            </button>
          )}
          {state.status === 'recording' && (
            <>
              <button
                type="button"
                onClick={() => recorder.pause()}
                className="rounded bg-neutral-600 px-4 py-2 text-white hover:bg-neutral-700"
              >
                一時停止
              </button>
              <button
                type="button"
                onClick={handleStop}
                disabled={saving}
                className="rounded bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                停止
              </button>
            </>
          )}
          {state.status === 'paused' && (
            <>
              <button
                type="button"
                onClick={() => recorder.resume()}
                className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                再開
              </button>
              <button
                type="button"
                onClick={handleStop}
                disabled={saving}
                className="rounded bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                停止
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-4">
        <Waveform analyser={recorder.analyser} active={state.status === 'recording'} />
      </div>

      {state.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
    </div>
  )
}
