import { useState } from 'react'
import type { Recording } from '../../lib/db'
import { useRecordingStore } from '../../stores/recordingStore'
import { useTranscriptStore } from '../../stores/transcriptStore'
import { useTranscription } from '../../lib/asr/useTranscription'
import { ModelLoadingIndicator } from '../ModelLoadingIndicator/ModelLoadingIndicator'
import { TranscriptView } from '../TranscriptView/TranscriptView'

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const STATUS_LABEL: Record<string, string> = {
  recording: '録音中',
  recorded: '録音済み',
  transcribing: '文字起こし中',
  transcribed: '文字起こし完了',
  summarizing: '要約中',
  done: '完了',
  error: 'エラー',
}

interface RecordingItemProps {
  recording: Recording
}

export function RecordingItem({ recording }: RecordingItemProps) {
  const remove = useRecordingStore((s) => s.remove)
  const updateStatus = useRecordingStore((s) => s.updateStatus)
  const saveTranscript = useTranscriptStore((s) => s.save)
  const { transcribe, progress } = useTranscription()
  const [showTranscript, setShowTranscript] = useState(false)
  const [transcribeError, setTranscribeError] = useState<string | null>(null)

  const canTranscribe = recording.status === 'recorded' || recording.status === 'error'
  const hasTranscript =
    recording.status === 'transcribed' ||
    recording.status === 'summarizing' ||
    recording.status === 'done'

  const handleTranscribe = async () => {
    setTranscribeError(null)
    await updateStatus(recording.id, 'transcribing')
    try {
      const { segments, fullText } = await transcribe(recording.id, recording.audioBlob)
      await saveTranscript({ recordingId: recording.id, segments, fullText })
      await updateStatus(recording.id, 'transcribed')
      setShowTranscript(true)
    } catch (err) {
      await updateStatus(recording.id, 'error')
      setTranscribeError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">{recording.title}</p>
          <p className="text-sm text-neutral-500">
            {new Date(recording.createdAt).toLocaleString('ja-JP')} ・{' '}
            {formatDuration(recording.durationMs)} ・{' '}
            {STATUS_LABEL[recording.status] ?? recording.status}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {canTranscribe && (
            <button
              type="button"
              onClick={handleTranscribe}
              disabled={progress.isRunning}
              className="text-sm text-blue-600 hover:underline disabled:opacity-50"
            >
              文字起こし開始
            </button>
          )}
          {hasTranscript && (
            <button
              type="button"
              onClick={() => setShowTranscript((v) => !v)}
              className="text-sm text-blue-600 hover:underline"
            >
              {showTranscript ? '文字起こしを隠す' : '文字起こしを見る'}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (confirm(`「${recording.title}」を削除しますか？`)) remove(recording.id)
            }}
            className="text-sm text-red-600 hover:underline"
          >
            削除
          </button>
        </div>
      </div>

      {progress.isRunning &&
        (progress.modelProgress !== null && progress.modelProgress < 100 ? (
          <ModelLoadingIndicator progress={progress.modelProgress} />
        ) : (
          <p className="mt-2 text-xs text-neutral-500">音声を解析中...</p>
        ))}
      {transcribeError && <p className="mt-2 text-sm text-red-600">{transcribeError}</p>}
      {showTranscript && <TranscriptView recordingId={recording.id} />}
    </li>
  )
}
