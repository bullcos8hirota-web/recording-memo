import { describe, expect, it, vi } from 'vitest'
import { updateSeries } from '../market/updateSeries'
import { JQuantsError } from '../market/jquants'

const bar = { date: '2026-09-04', open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 }
const targets = [
  { code: '7203', name: 'トヨタ' },
  { code: '8136', name: 'サンリオ' },
  { code: '7272', name: 'ヤマハ' },
]

describe('updateSeries', () => {
  it('全部取り込めたら全部成功で返す', async () => {
    const save = vi.fn(async () => undefined)
    const results = await updateSeries({
      targets,
      fetchBars: async () => [bar],
      save,
    })
    expect(results.every((r) => r.error === null)).toBe(true)
    expect(save).toHaveBeenCalledTimes(3)
  })

  it('1銘柄こけても残りは続ける', async () => {
    const results = await updateSeries({
      targets,
      fetchBars: async (code) => {
        if (code === '8136') throw new Error('だめ')
        return [bar]
      },
      save: async () => undefined,
    })
    expect(results.map((r) => r.error)).toEqual([null, 'だめ', null])
  })

  it('APIキーが違えばそこで打ち切り、残りは未取得にする', async () => {
    const fetchBars = vi.fn(async () => {
      throw new JQuantsError({ kind: 'auth', message: 'キーが違います' })
    })
    const results = await updateSeries({ targets, fetchBars, save: async () => undefined })
    expect(fetchBars).toHaveBeenCalledTimes(1)
    expect(results[1].skipped).toBe(true)
    expect(results[2].skipped).toBe(true)
  })

  it('利用上限でも打ち切る', async () => {
    const fetchBars = vi.fn(async () => {
      throw new JQuantsError({ kind: 'rate', message: '上限です' })
    })
    const results = await updateSeries({ targets, fetchBars, save: async () => undefined })
    expect(fetchBars).toHaveBeenCalledTimes(1)
    expect(results.filter((r) => r.skipped)).toHaveLength(2)
  })

  it('進み具合を知らせる', async () => {
    const onProgress = vi.fn()
    await updateSeries({ targets, fetchBars: async () => [bar], save: async () => undefined, onProgress })
    expect(onProgress).toHaveBeenNthCalledWith(3, 3, 3)
  })
})
