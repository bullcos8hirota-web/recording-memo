/**
 * 「今どこまでの終値が入っているべきか」を判断する。
 * 祝日は分からないので、平日かどうかと引け時刻だけで判定する。
 * 祝日に「入っていません」と出ることはあるが、入れ忘れを見逃すよりはよい。
 */

/** 東証の取引終了時刻(15:30)。少し余裕を見て15:40以降を「引け後」とする。 */
const CLOSE_HOUR = 15
const CLOSE_MINUTE = 40

const toDateString = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`

const isWeekday = (date: Date): boolean => date.getDay() !== 0 && date.getDay() !== 6

/**
 * 直近で終値が確定しているはずの営業日。
 * 平日の引け後なら当日、それ以外は直前の平日。
 */
export function lastExpectedTradingDate(now = new Date()): string {
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const afterClose =
    now.getHours() > CLOSE_HOUR ||
    (now.getHours() === CLOSE_HOUR && now.getMinutes() >= CLOSE_MINUTE)

  if (isWeekday(now) && afterClose) return toDateString(cursor)

  do {
    cursor.setDate(cursor.getDate() - 1)
  } while (!isWeekday(cursor))
  return toDateString(cursor)
}

/** 最終データ日から、入っているべき日まで何営業日空いているか。 */
export function missingTradingDays(lastDate: string, now = new Date()): number {
  const expected = lastExpectedTradingDate(now)
  if (lastDate >= expected) return 0

  let count = 0
  const cursor = new Date(`${expected}T00:00:00`)
  const target = new Date(`${lastDate}T00:00:00`)
  while (cursor > target) {
    if (isWeekday(cursor)) count += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return count
}
