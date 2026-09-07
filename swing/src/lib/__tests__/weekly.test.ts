import { describe, expect, it } from 'vitest'
import { weeklyPlan, MAX_TOTAL_RISK_PERCENT } from '../plan/weekly'
import { buildSampleData } from '../market/sampleData'
import { DEFAULT_SETTINGS } from '../db/schema'
import type { Trade } from '../money/trade'
import type { Bar, Stock } from '../market/types'

const samples = buildSampleData()
const allStocks = samples.map((sample) => sample.stock)
const series: Record<string, Bar[]> = Object.fromEntries(
  samples.map((sample) => [sample.stock.code, sample.bars]),
)
const last = samples[0].bars[samples[0].bars.length - 1].date
const now = new Date(`${last}T18:00:00`)
const settings = { ...DEFAULT_SETTINGS, capital: 5_000_000, riskPercent: 1 }

const trade = (patch: Partial<Trade> = {}): Trade => ({
  id: 't1',
  code: 'SMPL1',
  name: 'サンプルA(押し目)',
  side: 'long',
  entryDate: samples[0].bars[samples[0].bars.length - 10].date,
  entryPrice: 3_000,
  shares: 100,
  stopPrice: 2_900,
  targetPrice: null,
  exitDate: null,
  exitPrice: null,
  fees: 0,
  reason: '',
  review: '',
  tags: [],
  createdAt: 1,
  updatedAt: 1,
  ...patch,
})

const plan = (patch: { stocks?: Stock[]; trades?: Trade[]; settings?: typeof settings } = {}) =>
  weeklyPlan({
    stocks: patch.stocks ?? allStocks,
    series,
    trades: patch.trades ?? [],
    settings: patch.settings ?? settings,
    now,
  })

describe('weeklyPlan / 新規の注文', () => {
  it('条件が揃った銘柄から、週1銘柄だけ選ぶ', () => {
    const result = plan()
    expect(result.orders).toHaveLength(1)
    const order = result.orders[0]
    expect(order.trigger).toBeGreaterThan(0)
    expect(order.stopPrice).toBeLessThan(order.trigger)
    expect(order.shares).toBeGreaterThan(0)
  })

  it('点も出来高も並んだら、売買代金が大きいほうを選ぶ', () => {
    // 同じ値動きの2銘柄を作り、片方だけ出来高(=売買代金)を10倍にする。
    const source = samples.find((sample) => sample.stock.code === 'SMPL1')!
    const thin = source.bars.map((bar) => ({ ...bar, volume: bar.volume }))
    const thick = source.bars.map((bar) => ({ ...bar, volume: bar.volume * 10 }))
    const stocks: Stock[] = [
      { ...source.stock, code: 'THIN', name: '薄いほう' },
      { ...source.stock, code: 'THICK', name: '厚いほう' },
    ]
    const result = weeklyPlan({
      stocks,
      series: { THIN: thin, THICK: thick },
      trades: [],
      settings,
      now,
    })
    expect(result.orders[0].code).toBe('THICK')
    expect(result.skipped.find((item) => item.code === 'THIN')?.reason).toContain('週1銘柄')
  })

  it('選ばなかった銘柄には理由が付く', () => {
    const result = plan()
    for (const item of result.skipped) expect(item.reason).not.toBe('')
  })

  it('決算が近い銘柄は見送り、理由に日付を出す', () => {
    const soon = new Date(now)
    soon.setDate(soon.getDate() + 5)
    const date = soon.toISOString().slice(0, 10)
    const stocks = allStocks.map((stock) =>
      stock.code === 'SMPL1' ? { ...stock, earningsDate: date } : stock,
    )
    const result = plan({ stocks })
    expect(result.orders.some((order) => order.code === 'SMPL1')).toBe(false)
    expect(result.skipped.find((item) => item.code === 'SMPL1')?.reason).toContain(date)
  })

  it('決算日が未登録なら、そのことを注文に添える', () => {
    const result = plan()
    expect(result.orders[0].earningsUnknown).toBe(true)
  })

  it('建玉がある銘柄には注文を出さない', () => {
    const result = plan({ trades: [trade({ code: allStocks[0].code })] })
    expect(result.orders.some((order) => order.code === allStocks[0].code)).toBe(false)
  })

  it('注文中の銘柄には重ねて注文を出さない', () => {
    const stocks = allStocks.map((stock) =>
      stock.code === 'SMPL1'
        ? {
            ...stock,
            pendingOrder: {
              trigger: 3_200,
              shares: 100,
              stopPrice: 3_000,
              expiresOn: '2099-01-01',
              placedOn: '2026-01-01',
            },
          }
        : stock,
    )
    const result = plan({ stocks })
    expect(result.orders.some((order) => order.code === 'SMPL1')).toBe(false)
    expect(result.pending.map((item) => item.code)).toContain('SMPL1')
  })

  it('証券会社に出してある注文も、今週の1件として数える', () => {
    // 注文中の銘柄があるあいだは、別の銘柄の新規注文を勧めない。
    const stocks = allStocks.map((stock) =>
      stock.code === 'SMPL2'
        ? {
            ...stock,
            pendingOrder: {
              trigger: 1_200,
              shares: 100,
              stopPrice: 1_100,
              expiresOn: '2099-01-01',
              placedOn: '2026-01-01',
            },
          }
        : stock,
    )
    const result = plan({ stocks })
    expect(result.orders).toHaveLength(0)
    expect(result.skipped.some((item) => item.reason.includes('すでに'))).toBe(true)
  })

  it('期限切れの注文は枠を使っていない', () => {
    const stocks = allStocks.map((stock) =>
      stock.code === 'SMPL2'
        ? {
            ...stock,
            pendingOrder: {
              trigger: 1_200,
              shares: 100,
              stopPrice: 1_100,
              expiresOn: '2020-01-01',
              placedOn: '2020-01-01',
            },
          }
        : stock,
    )
    const result = plan({ stocks })
    expect(result.orders).toHaveLength(1)
  })

  it('資金が小さければ買える銘柄が無く、理由が残る', () => {
    const result = plan({ settings: { ...settings, capital: 200_000 } })
    expect(result.orders).toHaveLength(0)
    expect(result.skipped.length).toBeGreaterThan(0)
  })

  it('建玉のリスクが上限に達していたら新規を出さない', () => {
    // 買値と損切りの差 × 株数 が資金の3%を超える建玉を持たせる
    const heavy = trade({
      code: 'SMPL9999',
      entryPrice: 3_000,
      stopPrice: 1_000,
      shares: 100,
    })
    const result = plan({ trades: [heavy] })
    expect(result.totalRisk).toBeGreaterThan((settings.capital * MAX_TOTAL_RISK_PERCENT) / 100)
    expect(result.orders).toHaveLength(0)
  })
})

describe('weeklyPlan / 注文中の見張り', () => {
  const withOrder = (patch: Record<string, unknown> = {}, order: Record<string, unknown> = {}) =>
    allStocks.map((stock) =>
      stock.code === 'SMPL1'
        ? {
            ...stock,
            ...patch,
            pendingOrder: {
              trigger: 3_300,
              shares: 100,
              stopPrice: 3_100,
              expiresOn: '2099-01-01',
              placedOn: '2026-01-01',
              ...order,
            },
          }
        : stock,
    )

  const inDays = (days: number) => {
    const date = new Date(now)
    date.setDate(date.getDate() + days)
    return date.toISOString().slice(0, 10)
  }

  it('期限までに決算があれば取り消しを勧める', () => {
    const result = plan({ stocks: withOrder({ earningsDate: inDays(3) }) })
    const item = result.pending.find((entry) => entry.code === 'SMPL1')
    expect(item?.alert?.level).toBe('cancel')
    expect(item?.alert?.message).toContain('決算発表')
    // 手を動かすことがあるので「何もしない週」にはしない
    expect(result.nothingToDo).toBe(false)
  })

  it('期限までに権利落ちがあれば取り消しを勧める', () => {
    const result = plan({ stocks: withOrder({ exRightsDate: inDays(5) }) })
    expect(result.pending[0].alert?.level).toBe('cancel')
    expect(result.pending[0].alert?.message).toContain('権利確定日')
  })

  it('期限より後の決算は関係ない', () => {
    const result = plan({
      stocks: withOrder({ earningsDate: inDays(30) }, { expiresOn: inDays(4) }),
    })
    expect(result.pending[0].alert?.level).not.toBe('cancel')
  })

  it('条件が崩れたら知らせるが、取り消しは勧めない', () => {
    // 条件を満たさない銘柄(下降トレンドのサンプル)に注文を出してある状態にする
    const stocks = allStocks.map((stock) =>
      stock.code === 'SMPL3'
        ? {
            ...stock,
            pendingOrder: {
              trigger: 2_500,
              shares: 100,
              stopPrice: 2_300,
              expiresOn: '2099-01-01',
              placedOn: '2026-01-01',
              scoreAtOrder: 88,
            },
          }
        : stock,
    )
    const item = plan({ stocks }).pending.find((entry) => entry.code === 'SMPL3')
    expect(item?.alert?.level).toBe('notice')
    expect(item?.alert?.message).toContain('注文時のスコア88')
    expect(item?.alert?.message).toContain('期限切れを待つのが既定')
  })

  it('条件が揃ったままなら何も言わない', () => {
    expect(plan({ stocks: withOrder() }).pending[0].alert).toBeNull()
  })

  it('期限切れの注文は判定しない', () => {
    const result = plan({ stocks: withOrder({ earningsDate: inDays(3) }, { expiresOn: '2020-01-01' }) })
    expect(result.pending[0].expired).toBe(true)
    expect(result.pending[0].alert).toBeNull()
  })
})

describe('weeklyPlan / 建玉', () => {
  it('損切りが未設定なら、まずそれを促す', () => {
    const result = plan({ trades: [trade({ stopPrice: null })] })
    expect(result.positions[0].kind).toBe('set-stop')
    expect(result.nothingToDo).toBe(false)
  })

  it('買値より下の引き上げは勧めず、理由を出す', () => {
    const result = plan({ trades: [trade({ entryPrice: 999_999, stopPrice: 2_900 })] })
    expect(result.positions[0].kind).toBe('hold-stop')
    expect(result.positions[0].note).toContain('買値より下')
  })

  it('買値以上に届いたら引き上げを勧める', () => {
    const result = plan({ trades: [trade({ entryPrice: 100, stopPrice: 90 })] })
    expect(result.positions[0].kind).toBe('raise-stop')
    expect(result.positions[0].raiseTo).toBeGreaterThanOrEqual(100)
  })

  it('権利落ちが近い週は引き上げない', () => {
    const soon = new Date(now)
    soon.setDate(soon.getDate() + 3)
    const stocks = allStocks.map((stock) =>
      stock.code === 'SMPL1' ? { ...stock, exRightsDate: soon.toISOString().slice(0, 10) } : stock,
    )
    const result = plan({ stocks, trades: [trade({ entryPrice: 100, stopPrice: 90 })] })
    expect(result.positions[0].kind).toBe('hold-stop')
    expect(result.positions[0].note).toContain('権利落ち')
    expect(result.positions[0].warnings.join()).toContain('権利確定日')
  })

  it('決算が近ければ建玉に警告を付ける', () => {
    const soon = new Date(now)
    soon.setDate(soon.getDate() + 3)
    const stocks = allStocks.map((stock) =>
      stock.code === 'SMPL1' ? { ...stock, earningsDate: soon.toISOString().slice(0, 10) } : stock,
    )
    const result = plan({ stocks, trades: [trade()] })
    expect(result.positions[0].warnings.join()).toContain('決算発表')
    expect(result.nothingToDo).toBe(false)
  })
})

describe('weeklyPlan / 何もしない週', () => {
  it('注文も手当ても無ければ、何もしない週になる', () => {
    // 監視銘柄を建玉1件だけにして、その建玉は据え置きになる状態を作る
    const only = allStocks.filter((stock) => stock.code === 'SMPL1')
    const result = weeklyPlan({
      stocks: only,
      series,
      trades: [trade({ entryPrice: 999_999, stopPrice: 2_900 })],
      settings,
      now,
    })
    expect(result.orders).toHaveLength(0)
    expect(result.nothingToDo).toBe(true)
  })
})
