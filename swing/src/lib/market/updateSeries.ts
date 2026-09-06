import { JQuantsError } from './jquants'
import type { Bar } from './types'

export type UpdateResult = {
  code: string
  name: string
  /** 取り込めた本数。失敗したときは0。 */
  bars: number
  /** 失敗の理由。成功なら null。 */
  error: string | null
  /** 上限や認証で打ち切ったぶん。 */
  skipped: boolean
}

/**
 * 監視中の銘柄を順番に取り込む。
 *
 * 1銘柄こけても残りは続ける。ただし認証エラーと利用上限は、続けても同じ結果に
 * なるうえ相手に負荷をかけるので、そこで打ち切って残りは「未取得」として返す。
 */
export async function updateSeries(input: {
  targets: { code: string; name: string }[]
  fetchBars: (code: string) => Promise<Bar[]>
  save: (code: string, bars: Bar[]) => Promise<unknown>
  onProgress?: (done: number, total: number) => void
}): Promise<UpdateResult[]> {
  const { targets, fetchBars, save } = input
  const results: UpdateResult[] = []
  let stop: string | null = null

  for (const [index, target] of targets.entries()) {
    if (stop) {
      results.push({ ...target, bars: 0, error: stop, skipped: true })
      continue
    }
    try {
      const bars = await fetchBars(target.code)
      await save(target.code, bars)
      results.push({ ...target, bars: bars.length, error: null, skipped: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (error instanceof JQuantsError && (error.kind === 'auth' || error.kind === 'rate')) {
        stop = message
      }
      results.push({ ...target, bars: 0, error: message, skipped: false })
    }
    input.onProgress?.(index + 1, targets.length)
  }

  return results
}
