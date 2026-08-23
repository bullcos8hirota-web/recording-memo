import type { Bar, Stock } from './types'

/**
 * 使い始めにデータが空だと何も試せないので、動作確認用のサンプルを用意する。
 * 実在の銘柄ではなく、値動きも乱数で作った架空のもの。
 */
type Pattern = 'pullback' | 'breakout' | 'downtrend' | 'range' | 'overheat'

export type SampleStock = { stock: Stock; bars: Bar[] }

/** 線形合同法。毎回同じサンプルが出るように種を固定する。 */
function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

/** 土日を飛ばして日付を遡る。祝日までは考慮しない。 */
function tradingDates(count: number, end = new Date()): string[] {
  const dates: string[] = []
  const cursor = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  while (dates.length < count) {
    const day = cursor.getDay()
    if (day !== 0 && day !== 6) {
      dates.push(
        `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(
          cursor.getDate(),
        ).padStart(2, '0')}`,
      )
    }
    cursor.setDate(cursor.getDate() - 1)
  }
  return dates.reverse()
}

/** 期間中の1日あたりの上昇率(ドリフト)をパターンごとに変える。 */
function driftAt(pattern: Pattern, progress: number): number {
  switch (pattern) {
    case 'pullback':
      // 上昇 → 25日線まで調整 → 直近で反発、というスイングで狙いたい形。
      if (progress > 0.955) return 0.012
      if (progress > 0.88) return -0.009
      return 0.003
    case 'breakout':
      // 長いもみ合いのあと、最後に上放れ。
      return progress < 0.93 ? 0.0009 : 0.006
    case 'downtrend':
      return -0.0025
    case 'range':
      // 一定の値幅を行ったり来たりさせる。
      return Math.sin(progress * Math.PI * 6) * 0.005
    case 'overheat':
      // 終盤に急騰させ、25日線から上に離れすぎた状態を作る。
      if (progress > 0.9) return 0.022
      return progress < 0.6 ? 0.001 : 0.008
  }
}

function generateBars(
  seed: number,
  pattern: Pattern,
  startPrice: number,
  count: number,
): Bar[] {
  const random = createRandom(seed)
  const dates = tradingDates(count)
  const bars: Bar[] = []
  let price = startPrice

  for (let i = 0; i < count; i += 1) {
    const progress = i / (count - 1)
    const noise = (random() - 0.5) * 0.018
    price = Math.max(50, price * (1 + driftAt(pattern, progress) + noise))
    const open = price * (1 + (random() - 0.5) * 0.008)
    const close = price
    const high = Math.max(open, close) * (1 + random() * 0.01)
    const low = Math.min(open, close) * (1 - random() * 0.01)
    const spike = pattern === 'breakout' && progress > 0.975 ? 2.6 : 1
    const volume = Math.round((600_000 + random() * 900_000) * spike)
    bars.push({
      date: dates[i],
      open: Math.round(open * 10) / 10,
      high: Math.round(high * 10) / 10,
      low: Math.round(low * 10) / 10,
      close: Math.round(close * 10) / 10,
      volume,
    })
  }
  return bars
}

const DEFINITIONS: {
  code: string
  name: string
  pattern: Pattern
  price: number
  seed: number
  memo: string
}[] = [
  {
    code: 'SMPL1',
    name: 'サンプルA(押し目)',
    pattern: 'pullback',
    price: 1_800,
    seed: 11,
    memo: '上昇トレンド中に25日線まで調整した形',
  },
  {
    code: 'SMPL2',
    name: 'サンプルB(ブレイク)',
    pattern: 'breakout',
    price: 950,
    seed: 23,
    memo: 'もみ合いから出来高を伴って上放れた形',
  },
  {
    code: 'SMPL3',
    name: 'サンプルC(下降)',
    pattern: 'downtrend',
    price: 3_200,
    seed: 37,
    memo: '買い向かうと逆行しやすい形',
  },
  {
    code: 'SMPL4',
    name: 'サンプルD(レンジ)',
    pattern: 'range',
    price: 640,
    seed: 51,
    memo: '方向感が出ていない形',
  },
  {
    code: 'SMPL5',
    name: 'サンプルE(過熱)',
    pattern: 'overheat',
    price: 2_400,
    seed: 67,
    memo: '25日線から上に離れすぎた形',
  },
]

export function buildSampleData(bars = 180): SampleStock[] {
  const now = Date.now()
  return DEFINITIONS.map((definition, index) => ({
    stock: {
      code: definition.code,
      name: definition.name,
      lot: 100,
      memo: definition.memo,
      demo: true,
      createdAt: now + index,
    },
    bars: generateBars(
      definition.seed,
      definition.pattern,
      definition.price,
      bars,
    ),
  }))
}

export const SAMPLE_CODES = DEFINITIONS.map((d) => d.code)
