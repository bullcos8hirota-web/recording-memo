import type { TranscriptSegment } from '../db/schema'
import { getGeminiApiKey, getGeminiModel } from './settings'
import { assertBudgetAvailable, recordUsage } from './usage'

const MAX_INLINE_AUDIO_BYTES = 18 * 1024 * 1024

const resultSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    transcript: {
      type: 'object',
      properties: {
        segments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              start: { type: 'number' },
              end: { type: 'number' },
              speaker: { type: 'string' },
              text: { type: 'string' },
            },
            required: ['start', 'end', 'text'],
          },
        },
      },
      required: ['segments'],
    },
    summary: {
      type: 'object',
      properties: {
        overview: { type: 'string' },
        keyPoints: { type: 'array', items: { type: 'string' } },
        decisions: { type: 'array', items: { type: 'string' } },
        actionItems: { type: 'array', items: { type: 'string' } },
      },
      required: ['overview', 'keyPoints', 'decisions', 'actionItems'],
    },
  },
  required: ['title', 'tags', 'transcript', 'summary'],
}

export interface GeminiMeetingResult {
  title: string
  tags: string[]
  transcript: {
    fullText: string
    segments: TranscriptSegment[]
  }
  summary: {
    overview: string
    keyPoints: string[]
    decisions: string[]
    actionItems: string[]
  }
}

interface GenerateMeetingMinutesInput {
  audioBlob: Blob
  liveTranscript?: { fullText: string }
}

function buildPrompt(liveTranscript?: { fullText: string }): string {
  const liveTranscriptHint = liveTranscript?.fullText
    ? `\n\n端末側の参考文字起こし:\n${liveTranscript.fullText}`
    : ''

  return `
あなたは日本語の会議秘書です。音声を聞いて、仕事でそのまま使える議事録にしてください。

出力は必ずJSONだけにしてください。
要件:
- title: 内容が分かる短い日本語タイトル
- tags: 2〜5個の短い日本語タグ
- transcript.segments: できるだけ正確な全文を、発言のまとまりごとに分割して入れる。start/endは秒。話者が推定できる場合は speaker を入れる
- summary.overview: 会話全体の要約
- summary.keyPoints: 重要な話題
- summary.decisions: 決まったこと。なければ空配列
- summary.actionItems: TODO候補。担当者や期限が分かる場合は含める
- 推測が必要な部分は断定しすぎない
${liveTranscriptHint}
`.trim()
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(new Error('音声データの読み込みに失敗しました。'))
    reader.readAsDataURL(blob)
  })
}

function extractText(payload: unknown): string {
  const typedPayload = payload as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> }
      finishReason?: string
    }>
    promptFeedback?: { blockReason?: string }
  }
  const candidates = typedPayload?.candidates
  const parts = candidates?.[0]?.content?.parts ?? []
  const text = parts
    .map((part) => part.text ?? '')
    .join('')
    .trim()
  const finishReason = candidates?.[0]?.finishReason
  const blockReason = typedPayload?.promptFeedback?.blockReason

  if (blockReason) {
    throw new Error(`Geminiが音声の処理をブロックしました(理由: ${blockReason})。`)
  }
  if (finishReason === 'MAX_TOKENS' && !text.endsWith('}')) {
    throw new Error(
      '録音が長く、Geminiの出力上限に収まりきりませんでした。短めの録音で試すか、しばらくしてから「作り直す」をお試しください。',
    )
  }
  if (!text) {
    throw new Error(
      `Geminiの返答からテキストを読み取れませんでした。finishReason: ${finishReason ?? '不明'} / 返答全体: ${JSON.stringify(payload).slice(0, 500)}`,
    )
  }
  return text
}

function parseJsonText(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    const snippet = text.slice(0, 300)
    if (!match) {
      throw new Error(
        `Geminiの返答がJSONではありませんでした(録音が長すぎるか、出力が途中で切れた可能性があります)。返答の一部: ${snippet}`,
      )
    }
    try {
      return JSON.parse(match[0])
    } catch {
      throw new Error(`Geminiの返答のJSON解析に失敗しました。返答の一部: ${snippet}`)
    }
  }
}

function buildTranscript(rawSegments: unknown[]): { fullText: string; segments: TranscriptSegment[] } {
  const segments = rawSegments
    .map((segment) => segment as Record<string, unknown>)
    .map((segment) => ({
      start: Number(segment.start || 0),
      end: Number(segment.end || 0),
      speaker: segment.speaker ? String(segment.speaker) : undefined,
      text: String(segment.text || '').trim(),
    }))
    .filter((segment) => segment.text)

  return { segments, fullText: segments.map((segment) => segment.text).join('\n') }
}

function normalizeResult(result: Record<string, unknown>): GeminiMeetingResult {
  const transcript = (result.transcript as Record<string, unknown>) ?? {}
  const summary = (result.summary as Record<string, unknown>) ?? {}
  const rawSegments = Array.isArray(transcript.segments) ? transcript.segments : []

  return {
    title: String(result.title || '録音メモ'),
    tags: Array.isArray(result.tags) ? result.tags.filter(Boolean).map(String).slice(0, 8) : [],
    transcript: buildTranscript(rawSegments),
    summary: {
      overview: String(summary.overview || ''),
      keyPoints: Array.isArray(summary.keyPoints) ? summary.keyPoints.filter(Boolean).map(String) : [],
      decisions: Array.isArray(summary.decisions) ? summary.decisions.filter(Boolean).map(String) : [],
      actionItems: Array.isArray(summary.actionItems)
        ? summary.actionItems.filter(Boolean).map(String)
        : [],
    },
  }
}

export async function generateMeetingMinutes({
  audioBlob,
  liveTranscript,
}: GenerateMeetingMinutesInput): Promise<GeminiMeetingResult> {
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    throw new Error('Gemini APIキーが設定されていません。')
  }
  if (audioBlob.size > MAX_INLINE_AUDIO_BYTES) {
    throw new Error('音声が大きすぎます。まずは18MB未満の録音で試してください。')
  }

  assertBudgetAvailable()

  const model = getGeminiModel()
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`

  const audioData = await blobToBase64(audioBlob)

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: buildPrompt(liveTranscript) },
            {
              inlineData: {
                mimeType: audioBlob.type || 'audio/webm',
                data: audioData,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: resultSchema,
        maxOutputTokens: 32768,
        // 「思考」トークンが出力上限を食いつぶしてJSONが途中で切れるのを防ぐ
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Gemini API エラー: ${detail || response.status}`)
  }

  const payload = await response.json()
  recordUsage(model, payload.usageMetadata)

  return normalizeResult(parseJsonText(extractText(payload)))
}
