import { pipeline, type TextGenerationPipeline, type ProgressInfo } from '@huggingface/transformers'
import { SUMMARY_MODEL_ID, SUMMARY_SYSTEM_PROMPT } from '../lib/summarize/config'

export interface SummarizeRequest {
  type: 'summarize'
  recordingId: string
  transcriptText: string
}

export interface ParsedSummary {
  overview: string
  keyPoints: string[]
  decisions: string[]
  actionItems: string[]
}

export type SummarizeResponse =
  | { type: 'model-progress'; recordingId: string; progress: number }
  | { type: 'model-ready'; recordingId: string }
  | {
      type: 'result'
      recordingId: string
      summary: ParsedSummary
      rawText: string
      parsed: boolean
    }
  | { type: 'error'; recordingId: string; message: string }

let generatorPromise: Promise<TextGenerationPipeline> | null = null

function getGenerator(recordingId: string): Promise<TextGenerationPipeline> {
  if (!generatorPromise) {
    generatorPromise = pipeline('text-generation', SUMMARY_MODEL_ID, {
      device: 'auto',
      // Without an explicit dtype, transformers.js falls back to full fp32
      // weights (~6GB for this model) since dtype is resolved from the
      // requested device before the webgpu->wasm runtime fallback happens.
      // Force the int4-quantized weights (~1.8GB) regardless of device.
      dtype: 'q4',
      progress_callback: (info: ProgressInfo) => {
        if (info.status === 'progress_total') {
          post({ type: 'model-progress', recordingId, progress: info.progress })
        } else if (info.status === 'ready') {
          post({ type: 'model-ready', recordingId })
        }
      },
    })
  }
  return generatorPromise
}

function post(message: SummarizeResponse) {
  self.postMessage(message)
}

/** The model sometimes wraps the JSON in prose or a ```json fence; pull the object out. */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1)
  }
  return text.trim()
}

function parseSummary(rawText: string): { summary: ParsedSummary; parsed: boolean } {
  try {
    const json = JSON.parse(extractJson(rawText))
    return {
      parsed: true,
      summary: {
        overview: typeof json.overview === 'string' ? json.overview : '',
        keyPoints: Array.isArray(json.keyPoints) ? json.keyPoints.map(String) : [],
        decisions: Array.isArray(json.decisions) ? json.decisions.map(String) : [],
        actionItems: Array.isArray(json.actionItems) ? json.actionItems.map(String) : [],
      },
    }
  } catch {
    return {
      parsed: false,
      summary: { overview: rawText.trim(), keyPoints: [], decisions: [], actionItems: [] },
    }
  }
}

self.onmessage = async (event: MessageEvent<SummarizeRequest>) => {
  const { type, recordingId, transcriptText } = event.data
  if (type !== 'summarize') return

  try {
    const generator = await getGenerator(recordingId)
    const output = await generator(
      [
        { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: transcriptText },
      ],
      { max_new_tokens: 500, do_sample: false },
    )

    const lastMessage = output[0].generated_text.at(-1)
    const rawText = typeof lastMessage?.content === 'string' ? lastMessage.content : ''
    const { summary, parsed } = parseSummary(rawText)

    post({ type: 'result', recordingId, summary, rawText, parsed })
  } catch (err) {
    post({
      type: 'error',
      recordingId,
      message: err instanceof Error ? err.message : String(err),
    })
  }
}
