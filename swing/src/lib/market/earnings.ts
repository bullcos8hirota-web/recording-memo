/** 何日前から警告するか。1週間だと週次の見直しで間に合わないことがある。 */
export const EARNINGS_WARN_DAYS = 14

export type EarningsAlert = {
  /** 今日から決算発表日までの日数。過ぎていればマイナス。 */
  days: number
  /** 近いので、新規に買うなら見送りたい状態。 */
  soon: boolean
  /** 発表日が過ぎている(登録し直しが必要)。 */
  past: boolean
}

const toDay = (date: Date): number =>
  Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000

/**
 * 決算発表日までの距離を出す。
 * 損切りを置いていても、決算の翌朝はその価格を飛び越えて始まることがあるため、
 * 「持ち越すかどうか」は事前に決めておきたい。
 */
export function earningsAlert(
  earningsDate: string | null | undefined,
  now: Date = new Date(),
): EarningsAlert | null {
  if (!earningsDate) return null
  const [year, month, day] = earningsDate.split('-').map(Number)
  if (!year || !month || !day) return null
  const days = Date.UTC(year, month - 1, day) / 86_400_000 - toDay(now)
  return { days, soon: days >= 0 && days <= EARNINGS_WARN_DAYS, past: days < 0 }
}
