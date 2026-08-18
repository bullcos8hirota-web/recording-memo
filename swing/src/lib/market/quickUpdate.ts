import { parseNumber } from './csv'
import type { Bar, Stock } from './types'

/**
 * ポートフォリオ画面や株価一覧からコピーした文字列を、銘柄コードと価格の
 * 組に読み替える。毎晩CSVを作るのは現実的でないので、
 * 「画面をコピーして貼る」だけで終値を更新できるようにするための入口。
 */
export type QuoteLine = {
  /** 元の行(確認用に残す)。 */
  raw: string
  code: string | null
  /** 登録済み銘柄なら名前。 */
  name: string | null
  bar: Bar | null
  /** 読めなかった理由。 */
  error: string | null
}

/** 日本株の証券コード。4桁数字と、4文字目が英字の新形式(例: 130A)の両方。 */
const CODE_PATTERN = /^[0-9]{3}[0-9A-Z]$/

/**
 * 桁区切りのカンマだけを外す。「2,850」は数値だが「7203,2850」は区切りなので、
 * 3桁ずつ正しく区切られている並びだけを数値とみなす。
 */
const stripThousandSeparators = (value: string): string =>
  value.replace(/\b\d{1,3}(?:,\d{3})+\b/g, (match) => match.replace(/,/g, ''))

const toHalfWidth = (value: string): string =>
  value.replace(/[Ａ-Ｚａ-ｚ０-９．，％＋－]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))

/**
 * 1行から数値だけを拾う。変化率(%)や前日比の符号付き数値は価格ではないので落とす。
 */
function extractNumbers(tokens: string[]): number[] {
  const numbers: number[] = []
  for (const token of tokens) {
    if (token.includes('%')) continue
    // +120 や -1.5 のような前日比は価格ではない
    if (/^[+\-▲△]/.test(token)) continue
    const value = parseNumber(token)
    if (value === null || value <= 0) continue
    numbers.push(value)
  }
  return numbers
}

/**
 * 出来高は桁が大きく、価格と紛れやすい。100株単位で万を超える値が
 * 末尾にあれば出来高とみなす。
 */
function splitPriceAndVolume(numbers: number[]): { prices: number[]; volume: number | null } {
  if (numbers.length >= 2) {
    const last = numbers[numbers.length - 1]
    const others = numbers.slice(0, -1)
    const maxPrice = Math.max(...others)
    if (last >= 10_000 && last > maxPrice * 20 && Number.isInteger(last)) {
      return { prices: others, volume: last }
    }
  }
  return { prices: numbers, volume: null }
}

/**
 * 貼り付けた文字列を1行ずつ解釈する。
 * 「7203 2850」「7203,2840,2870,2830,2850」「トヨタ自動車 7203 2,850 +1.2%」などを想定する。
 */
export function parseQuoteLines(text: string, stocks: Stock[], date: string): QuoteLine[] {
  const byCode = new Map(stocks.map((stock) => [stock.code.toUpperCase(), stock]))
  const results: QuoteLine[] = []

  for (const rawLine of text.split('\n')) {
    const raw = rawLine.trim()
    if (raw === '') continue

    const normalized = stripThousandSeparators(toHalfWidth(raw))
    const tokens = normalized.split(/[\s,、|]+/).filter(Boolean)
    // 価格も4桁の数字になりうるので、確実な手がかりから順に見る。
    // ①登録済みの銘柄名 → ②登録済みのコード → ③コードらしい並びのうち左端。
    const byName = [...stocks]
      .filter((stock) => stock.name)
      .sort((a, b) => b.name.length - a.name.length)
      .find((stock) => raw.includes(stock.name))
    const code =
      byName?.code.toUpperCase() ??
      tokens.find((token) => byCode.has(token.toUpperCase()))?.toUpperCase() ??
      tokens.find((token) => CODE_PATTERN.test(token.toUpperCase()))?.toUpperCase() ??
      null

    if (code === null) {
      results.push({ raw, code: null, name: null, bar: null, error: '銘柄コードが見つかりません' })
      continue
    }

    const codeIndex = tokens.findIndex((token) => token.toUpperCase() === code)
    const after = codeIndex >= 0 ? tokens.slice(codeIndex + 1) : tokens
    const { prices, volume } = splitPriceAndVolume(extractNumbers(after))

    if (prices.length === 0) {
      results.push({
        raw,
        code,
        name: byCode.get(code)?.name ?? null,
        bar: null,
        error: '価格が読み取れません',
      })
      continue
    }

    // 4つ以上あれば始値・高値・安値・終値、1〜3個なら最初の値を終値として扱う
    const bar: Bar =
      prices.length >= 4
        ? {
            date,
            open: prices[0],
            high: prices[1],
            low: prices[2],
            close: prices[3],
            volume: volume ?? 0,
          }
        : {
            date,
            open: prices[0],
            high: prices[0],
            low: prices[0],
            close: prices[0],
            volume: volume ?? 0,
          }

    results.push({ raw, code, name: byCode.get(code)?.name ?? null, bar, error: null })
  }

  return results
}
