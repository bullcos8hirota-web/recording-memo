import { useState } from 'react'
import { db, type Recording } from '../../lib/db'
import { useRecordingStore } from '../../stores/recordingStore'
import { useTranscriptStore } from '../../stores/transcriptStore'
import { useSummaryStore } from '../../stores/summaryStore'
import { useTranscription } from '../../lib/asr/useTranscription'
import { useSummarization } from '../../lib/summarize/useSummarization'
import { ModelLoadingIndicator } from '../ModelLoadingIndicator/ModelLoadingIndicator'
import { TranscriptView } from '../TranscriptView/TranscriptView'
import { SummaryView } from '../SummaryView/SummaryView'

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
  const saveSummary = useSummaryStore((s) => s.save)
  const { transcribe, progress: transcribeProgress } = useTranscription()
  const { summarize, progress: summarizeProgress } = useSummarization()
  const [showTranscript, setShowTranscript] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [transcribeError, setTranscribeError] = useState<string | null>(null)
  const [summarizeError, setSummarizeError] = useState<string | null>(null)

  const canTranscribe = recording.status === 'recorded' || recording.status === 'error'
  const hasTranscript =
    recording.status === 'transcribed' ||
    recording.status === 'summarizing' ||
    recording.status === 'done'
  const hasSummary = recording.status === 'done'

  const runSummarize = async (transcriptText: string) => {
    setSummarizeError(null)
    await updateStatus(recording.id, 'summarizing')
    try {
      const { summary, parsed } = await summarize(recording.id, transcriptText)
      await saveSummary({ recordingId: recording.id, ...summary })
      await updateStatus(recording.id, 'done')
      if (!parsed) {
        setSummarizeError(
          '要約の自動解析に失敗したため、モデルの出力をそのまま概要欄に表示しています。',
        )
      }
      setShowSummary(true)
    } catch (err) {
      await updateStatus(recording.id, 'error')
      setSummarizeError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleTranscribe = async () => {
    setTranscribeError(null)
    await updateStatus(recording.id, 'transcribing')
    try {
      const { segments, fullText } = await transcribe(recording.id, recording.audioBlob)
      await saveTranscript({ recordingId: recording.id, segments, fullText })
      await updateStatus(recording.id, 'transcribed')
      setShowTranscript(true)
      await runSummarize(fullText)
    } catch (err) {
      await updateStatus(recording.id, 'error')
      setTranscribeError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleRegenerateSummary = async () => {
    const transcript = await db.transcripts.get(recording.id)
    if (transcript) await runSummarize(transcript.fullText)
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
              disabled={transcribeProgress.isRunning || summarizeProgress.isRunning}
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
          {hasSummary && (
            <button
              type="button"
              onClick={() => setShowSummary((v) => !v)}
              className="text-sm text-blue-600 hover:underline"
            >
              {showSummary ? '要約を隠す' : '要約を見る'}
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

      {transcribeProgress.isRunning &&
        (transcribeProgress.modelProgress !== null && transcribeProgress.modelProgress < 100 ? (
          <ModelLoadingIndicator
            progress={transcribeProgress.modelProgress}
            label="文字起こしモデル"
          />
        ) : (
          <p className="mt-2 text-xs text-neutral-500">音声を解析中...</p>
        ))}
      {transcribeError && <p className="mt-2 text-sm text-red-600">{transcribeError}</p>}
      {showTranscript && <TranscriptView recordingId={recording.id} />}

      {summarizeProgress.isRunning &&
        (summarizeProgress.modelProgress !== null && summarizeProgress.modelProgress < 100 ? (
          <ModelLoadingIndicator progress={summarizeProgress.modelProgress} label="要約モデル" />
        ) : (
          <p className="mt-2 text-xs text-neutral-500">要約を生成中...</p>
        ))}
      {summarizeError && <p className="mt-2 text-sm text-amber-600">{summarizeError}</p>}
      {showSummary && (
        <SummaryView
          recordingId={recording.id}
          onRegenerate={handleRegenerateSummary}
          regenerating={summarizeProgress.isRunning}
        />
      )}
    </li>
  )
}
