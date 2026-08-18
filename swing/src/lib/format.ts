const yenFormatter = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 })
const priceFormatter = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1 })

/** -0 が「-0円」と表示されるのを避ける。 */
const normalize = (value: number): number => (value === 0 ? 0 : value)

export function yen(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${yenFormatter.format(normalize(Math.round(value)))}円`
}

export function signedYen(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${yenFormatter.format(normalize(Math.round(value)))}円`
}

export function price(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return priceFormatter.format(normalize(value))
}

export function percent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${normalize(value).toFixed(digits)}%`
}

export function ratio(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return '—'
  if (!Number.isFinite(value)) return '∞'
  return value.toFixed(digits)
}

export function count(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return yenFormatter.format(value)
}

export function shortDate(date: string | null | undefined): string {
  if (!date) return '—'
  const [, month, day] = date.split('-')
  return month && day ? `${Number(month)}/${Number(day)}` : date
}

export function today(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`
}

export function toneClass(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return 'text-neutral-500 dark:text-neutral-400'
  return value > 0
    ? 'text-rose-600 dark:text-rose-400'
    : 'text-sky-600 dark:text-sky-400'
}
