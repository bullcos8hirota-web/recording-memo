import type { Verdict } from '../../lib/learn/buffett'

/** 財務判定の見た目。上げ=赤、下げ=青というチャートの配色に合わせている。 */
export const VERDICT_STYLE: Record<Verdict, { label: string; className: string }> = {
  good: { label: '良い', className: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' },
  ok: { label: 'まずまず', className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  weak: { label: '弱い', className: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300' },
  unknown: {
    label: '未入力',
    className: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
  },
}
