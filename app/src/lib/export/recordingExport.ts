import type { Recording, Summary, Transcript } from '../db/schema'

export function formatRecordingDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function formatRecordingDate(ms: number): string {
  return new Date(ms).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function sanitizeFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '_').trim() || 'recording'
}

export function getAudioExtension(blob: Blob): string {
  if (blob.type.includes('wav')) return 'wav'
  if (blob.type.includes('mp4')) return 'm4a'
  return 'webm'
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function downloadText(text: string, filename: string, type: string) {
  downloadBlob(new Blob([text], { type }), filename)
}

function formatList(items: string[], fallback = 'なし'): string {
  if (items.length === 0) return fallback
  return items.map((item) => `- ${item}`).join('\n')
}

export function buildMarkdownExport(
  recording: Recording,
  transcript?: Transcript,
  summary?: Summary,
): string {
  return [
    `# ${recording.title}`,
    '',
    `- 作成日時: ${formatRecordingDate(recording.createdAt)}`,
    `- 長さ: ${formatRecordingDuration(recording.durationMs)}`,
    `- タグ: ${recording.tags.length > 0 ? recording.tags.join(', ') : 'なし'}`,
    recording.driveUrl ? `- Drive: ${recording.driveUrl}` : '',
    '',
    '## 要約',
    summary?.overview || 'なし',
    '',
    '## 主な内容',
    formatList(summary?.keyPoints ?? []),
    '',
    '## 決定事項',
    formatList(summary?.decisions ?? []),
    '',
    '## TODO候補',
    formatList(summary?.actionItems ?? []),
    '',
    '## 文字起こし',
    transcript?.fullText || 'なし',
    '',
  ]
    .filter((line) => line !== '')
    .join('\n')
}

export function buildTextExport(
  recording: Recording,
  transcript?: Transcript,
  summary?: Summary,
): string {
  return buildMarkdownExport(recording, transcript, summary).replace(/^#+ /gm, '')
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function htmlParagraphs(value: string): string {
  return value
    .split(/\n+/)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('')
}

function htmlList(items: string[], fallback = 'なし'): string {
  if (items.length === 0) return `<p>${fallback}</p>`
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
}

export function buildDocumentHtml(
  recording: Recording,
  transcript?: Transcript,
  summary?: Summary,
): string {
  return [
    `<h1>${escapeHtml(recording.title)}</h1>`,
    `<p>作成日時: ${escapeHtml(formatRecordingDate(recording.createdAt))} ／ 長さ: ${escapeHtml(
      formatRecordingDuration(recording.durationMs),
    )}</p>`,
    '<h2>要約</h2>',
    htmlParagraphs(summary?.overview || 'なし'),
    '<h2>主な内容</h2>',
    htmlList(summary?.keyPoints ?? []),
    '<h2>決定事項</h2>',
    htmlList(summary?.decisions ?? []),
    '<h2>TODO候補</h2>',
    htmlList(summary?.actionItems ?? []),
    '<h2>文字起こし</h2>',
    htmlParagraphs(transcript?.fullText || 'なし'),
  ].join('\n')
}
