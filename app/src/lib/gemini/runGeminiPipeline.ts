import { db, type Recording, type Transcript } from '../db'
import { buildFallbackSummary } from '../summarize/fallback'
import { generateMeetingMinutes } from './client'
import { getGeminiApiKey } from './settings'

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)))
}

export async function runGeminiPipeline(
  recording: Recording,
  options: {
    liveTranscript?: Transcript
    requireGemini?: boolean
  } = {},
) {
  const apiKey = getGeminiApiKey()

  if (!apiKey) {
    const transcript =
      options.liveTranscript ??
      (await db.transcripts.get(recording.id)) ?? {
        recordingId: recording.id,
        segments: [],
        fullText: '',
      }
    const summary = buildFallbackSummary(recording.id, transcript.fullText)
    await db.summaries.put(summary)
    await db.recordings.update(recording.id, {
      status: 'done',
      tags: uniqueTags([...recording.tags, '端末整理']),
      errorMessage: options.requireGemini
        ? 'Gemini APIキーがまだ設定されていません。設定画面でAPIキーを入れると本格的な議事録が作れます。'
        : undefined,
    })
    if (options.requireGemini) {
      throw new Error('Gemini APIキーがまだ設定されていません。')
    }
    return
  }

  try {
    await db.recordings.update(recording.id, { status: 'transcribing', errorMessage: undefined })
    const result = await generateMeetingMinutes({
      audioBlob: recording.audioBlob,
      liveTranscript: options.liveTranscript,
    })

    await db.recordings.update(recording.id, { status: 'summarizing' })

    const transcript: Transcript = {
      recordingId: recording.id,
      fullText: result.transcript.fullText,
      segments: result.transcript.segments,
    }
    await db.transcripts.put(transcript)

    const summary = {
      recordingId: recording.id,
      overview: result.summary.overview,
      keyPoints: result.summary.keyPoints,
      decisions: result.summary.decisions,
      actionItems: result.summary.actionItems,
    }
    await db.summaries.put(summary)

    await db.recordings.update(recording.id, {
      title: result.title.trim() || recording.title,
      tags: uniqueTags([...recording.tags, 'AI議事録', ...result.tags]),
      status: 'done',
      processedAt: Date.now(),
      errorMessage: undefined,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await db.recordings.update(recording.id, {
      status: 'error',
      errorMessage: message,
    })
    throw error
  }
}
