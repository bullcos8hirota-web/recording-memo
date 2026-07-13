import { useEffect, useMemo, useState } from 'react'
import { runGeminiPipeline } from '../../lib/gemini/runGeminiPipeline'
import { db, type Recording, type Summary, type Transcript } from '../../lib/db'
import {
  createGoogleDoc,
  getStoredGoogleClientId,
  requestGoogleDriveToken,
  subscribeToGoogleDriveSettingsChange,
} from '../../lib/drive/googleDrive'
import {
  buildDocumentHtml,
  buildMarkdownExport,
  buildTextExport,
  downloadBlob,
  downloadText,
  formatRecordingDate,
  formatRecordingDuration,
  getAudioExtension,
  sanitizeFilename,
} from '../../lib/export/recordingExport'
import { buildFallbackSummary } from '../../lib/summarize/fallback'
import { useRecordingStore } from '../../stores/recordingStore'
import { useSummaryStore } from '../../stores/summaryStore'
import { SummaryView } from '../SummaryView/SummaryView'
import { TranscriptView } from '../TranscriptView/TranscriptView'

const STATUS_LABEL: Record<Recording['status'], string> = {
  recorded: '保存済み',
  transcribing: '文字起こし中',
  summarizing: 'AIメモ作成中',
  done: '保存済み',
  error: '確認が必要',
}

interface RecordingItemProps {
  recording: Recording
}

export function RecordingItem({ recording }: RecordingItemProps) {
  const remove = useRecordingStore((s) => s.remove)
  const updateRecording = useRecordingStore((s) => s.update)
  const loadRecordings = useRecordingStore((s) => s.loadAll)
  const saveSummary = useSummaryStore((s) => s.save)
  const [expanded, setExpanded] = useState(false)
  const [titleDraft, setTitleDraft] = useState(recording.title)
  const [summaryPreview, setSummaryPreview] = useState('')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [driveConnected, setDriveConnected] = useState(Boolean(getStoredGoogleClientId()))

  useEffect(() => {
    return subscribeToGoogleDriveSettingsChange(() => {
      setDriveConnected(Boolean(getStoredGoogleClientId()))
    })
  }, [])

  const isProcessing =
    busy || recording.status === 'transcribing' || recording.status === 'summarizing'

  const filenameBase = useMemo(
    () => sanitizeFilename(`${formatRecordingDate(recording.createdAt)}_${recording.title}`),
    [recording.createdAt, recording.title],
  )

  useEffect(() => {
    setTitleDraft(recording.title)
  }, [recording.title])

  useEffect(() => {
    let cancelled = false
    db.summaries.get(recording.id).then((summary) => {
      if (!cancelled) setSummaryPreview(summary?.overview ?? '')
    })
    return () => {
      cancelled = true
    }
  }, [recording.id, recording.status])

  useEffect(() => {
    if (!expanded) {
      setAudioUrl(null)
      return
    }
    const url = URL.createObjectURL(recording.audioBlob)
    setAudioUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [recording.audioBlob, expanded])

  const loadArtifacts = async (): Promise<{
    transcript?: Transcript
    summary?: Summary
  }> => {
    const [transcript, existingSummary] = await Promise.all([
      db.transcripts.get(recording.id),
      db.summaries.get(recording.id),
    ])
    if (existingSummary) return { transcript, summary: existingSummary }

    const fallbackSummary = buildFallbackSummary(recording.id, transcript?.fullText ?? '')
    await saveSummary(fallbackSummary)
    setSummaryPreview(fallbackSummary.overview)
    return { transcript, summary: fallbackSummary }
  }

  const commitTitle = async () => {
    const nextTitle = titleDraft.trim()
    if (nextTitle && nextTitle !== recording.title) {
      await updateRecording(recording.id, { title: nextTitle })
    } else {
      setTitleDraft(recording.title)
    }
  }

  const handleAiMinutes = async () => {
    setBusy(true)
    setExpanded(true)
    setMessage('AIメモを作成しています。録音が長い場合は少し時間がかかります。')
    try {
      await runGeminiPipeline(recording, { requireGemini: true })
      await loadRecordings()
      const summary = await db.summaries.get(recording.id)
      setSummaryPreview(summary?.overview ?? '')
      setMessage('AIメモを作成しました。')
    } catch (error) {
      await loadRecordings()
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const handleShare = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const { transcript, summary } = await loadArtifacts()
      const markdown = buildMarkdownExport(recording, transcript, summary)
      const markdownFile = new File([markdown], `${filenameBase}.md`, {
        type: 'text/markdown;charset=utf-8',
      })
      const textFile = new File(
        [buildTextExport(recording, transcript, summary)],
        `${filenameBase}.txt`,
        { type: 'text/plain;charset=utf-8' },
      )
      const audioFile = new File(
        [recording.audioBlob],
        `${filenameBase}.${getAudioExtension(recording.audioBlob)}`,
        { type: recording.audioBlob.type || 'application/octet-stream' },
      )
      const files = [markdownFile, textFile, audioFile]

      if (navigator.share && navigator.canShare?.({ files })) {
        await navigator.share({
          title: recording.title,
          text: summary?.overview || recording.title,
          files,
        })
        setMessage('共有しました。Google Driveなどのアプリを選ぶと保存できます。')
      } else if (navigator.share) {
        await navigator.share({
          title: recording.title,
          text: markdown,
        })
        setMessage('メモ本文を共有しました。')
      } else {
        downloadText(markdown, `${filenameBase}.md`, 'text/markdown;charset=utf-8')
        downloadText(
          buildTextExport(recording, transcript, summary),
          `${filenameBase}.txt`,
          'text/plain;charset=utf-8',
        )
        downloadBlob(
          recording.audioBlob,
          `${filenameBase}.${getAudioExtension(recording.audioBlob)}`,
        )
        setMessage('共有に未対応のため、ファイルをダウンロードしました。')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const handleSaveToDrive = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const clientId = getStoredGoogleClientId()
      if (!clientId) throw new Error('Drive連携が設定されていません。設定画面でOAuthクライアントIDを入れてください。')

      const { transcript, summary } = await loadArtifacts()
      const html = buildDocumentHtml(recording, transcript, summary)
      const token = await requestGoogleDriveToken(clientId)
      const doc = await createGoogleDoc(token, recording.title || filenameBase, html)
      await updateRecording(recording.id, { driveUrl: doc.url })
      setMessage('Googleドキュメントとして保存しました。')
      window.open(doc.url, '_blank', 'noopener')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (window.confirm(`「${recording.title}」を削除しますか？`)) {
      await remove(recording.id)
    }
  }

  return (
    <li className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="space-y-3">
        <div>
          <input
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={commitTitle}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') setTitleDraft(recording.title)
            }}
            className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-lg font-semibold outline-none hover:border-neutral-300 focus:border-blue-500 dark:hover:border-neutral-700"
            aria-label="メモタイトル"
          />
          <p className="mt-1 text-sm text-neutral-500">
            {formatRecordingDate(recording.createdAt)} ・{' '}
            {formatRecordingDuration(recording.durationMs)} ・ {STATUS_LABEL[recording.status]}
          </p>
          {summaryPreview && !expanded && (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-700 dark:text-neutral-200">
              {summaryPreview}
            </p>
          )}
          {isProcessing && (
            <p className="mt-3 text-sm text-blue-600 dark:text-blue-300">
              AIメモを作成中です。このまま少し待ってください。
            </p>
          )}
          {recording.errorMessage && (
            <p className="mt-3 text-sm text-amber-600">{recording.errorMessage}</p>
          )}
          {recording.driveUrl && (
            <a
              href={recording.driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-blue-600 underline dark:text-blue-400"
            >
              Googleドキュメントを開く
            </a>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="rounded bg-blue-600 px-3 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {expanded ? '閉じる' : '詳しく見る'}
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={busy}
            className="rounded border border-neutral-300 px-3 py-3 text-sm hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            共有・保存
          </button>
          {driveConnected && (
            <button
              type="button"
              onClick={handleSaveToDrive}
              disabled={busy}
              className="rounded border border-neutral-300 px-3 py-3 text-sm hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Googleドキュメントで保存
            </button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            className="rounded border border-red-200 px-3 py-3 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
          >
            削除
          </button>
        </div>
      </div>

      {message && <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">{message}</p>}

      {expanded && (
        <div className="mt-4 space-y-4">
          {audioUrl && (
            <audio className="w-full" controls src={audioUrl}>
              このブラウザでは音声を再生できません。
            </audio>
          )}
          <SummaryView
            recordingId={recording.id}
            onRegenerate={handleAiMinutes}
            regenerating={isProcessing}
          />
          <TranscriptView recordingId={recording.id} />
        </div>
      )}
    </li>
  )
}
