import type { Summary } from '../db/schema'

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[。！？!?])\s*/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function pickLikelyItems(sentences: string[], patterns: RegExp[]): string[] {
  return sentences
    .filter((sentence) => patterns.some((pattern) => pattern.test(sentence)))
    .slice(0, 5)
}

export function buildFallbackSummary(recordingId: string, transcriptText: string): Summary {
  const sentences = splitSentences(transcriptText)
  const overview =
    sentences.slice(0, 3).join('') ||
    transcriptText.trim().slice(0, 180) ||
    '音声を保存しました。文字起こしはまだありません。'

  const keyPoints =
    sentences.length > 0
      ? sentences.slice(0, 5)
      : ['音声ファイルを保存しました。必要に応じて再生して内容を確認できます。']
  const decisions = pickLikelyItems(sentences, [
    /決定|決め|確定|合意|採用|承認/,
    /することになりました|で進めます|にします/,
  ])
  const actionItems = pickLikelyItems(sentences, [
    /TODO|ToDo|対応|確認|共有|送付|作成|準備|連絡|調整|お願いします/,
    /やります|します|しておきます|ください/,
  ])

  return {
    recordingId,
    overview,
    keyPoints,
    decisions,
    actionItems,
  }
}

export function isLikelyMemoryError(message: string): boolean {
  return /bad_alloc|out of memory|memory|allocation|session/i.test(message)
}
