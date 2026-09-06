import { describe, expect, it, vi } from 'vitest'
import { fetchDailyBars, JQuantsError, rowsToBars } from '../market/jquants'

const row = (date: string, close: number, extra: Record<string, unknown> = {}) => ({
  Date: date,
  AdjO: close - 1,
  AdjH: close + 2,
  AdjL: close - 3,
  AdjC: close,
  AdjVo: 1000,
  ...extra,
})

const ok = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response

const status = (code: number) =>
  ({ ok: false, status: code, json: async () => ({}) }) as unknown as Response

describe('rowsToBars', () => {
  it('調整済みの値を使う', () => {
    const bars = rowsToBars([row('2026-09-04', 1000)])
    expect(bars[0]).toEqual({
      date: '2026-09-04',
      open: 999,
      high: 1002,
      low: 997,
      close: 1000,
      volume: 1000,
    })
  })

  it('取引が無かった日(四本値がnull)は落とす', () => {
    const bars = rowsToBars([
      row('2026-09-03', 1000),
      { Date: '2026-09-04', AdjO: null, AdjH: null, AdjL: null, AdjC: null, AdjVo: null },
    ])
    expect(bars.map((bar) => bar.date)).toEqual(['2026-09-03'])
  })

  it('日付順に並べ直す', () => {
    const bars = rowsToBars([row('2026-09-04', 1010), row('2026-09-02', 1000)])
    expect(bars.map((bar) => bar.date)).toEqual(['2026-09-02', '2026-09-04'])
  })

  it('出来高が無ければ0にする', () => {
    expect(rowsToBars([row('2026-09-04', 1000, { AdjVo: null })])[0].volume).toBe(0)
  })
})

describe('fetchDailyBars', () => {
  const base = { apiKey: 'key', code: '7203', from: '2026-01-01', to: '2026-09-04' }

  it('APIキーをヘッダに載せて期間で取る', async () => {
    const fetchImpl = vi.fn(async () => ok({ data: [row('2026-09-04', 3000)] }))
    const bars = await fetchDailyBars({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(bars).toHaveLength(1)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('https://api.jquants.com/v2/equities/bars/daily')
    expect(url).toContain('code=7203')
    expect(url).toContain('from=2026-01-01')
    expect(url).toContain('to=2026-09-04')
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('key')
  })

  it('pagination_key があれば続きを取りに行く', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(ok({ data: [row('2026-09-03', 1000)], pagination_key: 'next' }))
      .mockResolvedValueOnce(ok({ data: [row('2026-09-04', 1010)] }))
    const bars = await fetchDailyBars({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(bars.map((bar) => bar.date)).toEqual(['2026-09-03', '2026-09-04'])
    expect(String(fetchImpl.mock.calls[1][0])).toContain('pagination_key=next')
  })

  it('直接叩けなければ中継に切り替える', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(ok({ data: [row('2026-09-04', 3000)] }))
    const bars = await fetchDailyBars({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(bars).toHaveLength(1)
    expect(String(fetchImpl.mock.calls[1][0])).toContain('/api/jquants')
  })

  it('キーが違えば中継を試さずにそのまま伝える', async () => {
    const fetchImpl = vi.fn(async () => status(401))
    await expect(
      fetchDailyBars({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toMatchObject({ kind: 'auth' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('利用上限は上限として伝える', async () => {
    const fetchImpl = vi.fn(async () => status(429))
    await expect(
      fetchDailyBars({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toMatchObject({ kind: 'rate' })
  })

  it('中身が空なら銘柄コードを疑わせる', async () => {
    const fetchImpl = vi.fn(async () => ok({ data: [] }))
    await expect(
      fetchDailyBars({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toBeInstanceOf(JQuantsError)
  })

  it('APIキーが未設定なら通信しない', async () => {
    const fetchImpl = vi.fn()
    await expect(
      fetchDailyBars({ ...base, apiKey: '', fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toMatchObject({ kind: 'auth' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
