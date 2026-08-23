import type { Fundamentals, Statements } from './buffett'

/**
 * 企業情報のページを貼り付けて、必要な数字だけ拾う。
 * 株価と同じで、どこに何が書いてあるかを覚えるより、貼って拾わせるほうが早い。
 * 見出しの言い回しはサイトごとに違うので、別名をまとめて持つ。
 */
type RatioKey = keyof Omit<Fundamentals, 'fcfPositive'>

const RATIO_LABELS: { key: RatioKey; names: string[] }[] = [
  { key: 'roe', names: ['ROE', '自己資本利益率', '株主資本利益率'] },
  { key: 'operatingMargin', names: ['営業利益率', '売上高営業利益率'] },
  { key: 'equityRatio', names: ['自己資本比率'] },
  { key: 'per', names: ['PER', '株価収益率'] },
  { key: 'pbr', names: ['PBR', '株価純資産倍率'] },
]

const AMOUNT_LABELS: { key: keyof Statements; names: string[] }[] = [
  { key: 'revenue', names: ['売上高', '営業収益', '売上収益'] },
  { key: 'operatingProfit', names: ['営業利益'] },
  { key: 'netProfit', names: ['当期純利益', '純利益', '親会社株主に帰属する当期純利益'] },
  { key: 'equity', names: ['自己資本', '純資産'] },
  { key: 'assets', names: ['総資産'] },
  { key: 'debt', names: ['有利子負債'] },
]

const NUMBER = /-?[0-9][0-9,]*(?:\.[0-9]+)?/

/**
 * 「4兆5,095億円」「5,400億円」「93,000百万円」を百万円に直す。
 * 単位が付いていない数字は読まない。桁を取り違えると比率が桁違いになるため。
 */
const JP_AMOUNT =
  /(?:([\d,]+(?:\.\d+)?)兆)?(?:([\d,]+(?:\.\d+)?)億)?(?:([\d,]+(?:\.\d+)?)百万)?(?:([\d,]+(?:\.\d+)?)万)?円/

const digits = (value: string | undefined): number =>
  value === undefined ? 0 : Number(value.replace(/,/g, ''))

export function parseAmountToMillion(text: string): number | null {
  const match = text.match(JP_AMOUNT)
  if (!match) return null
  const [, tri, oku, million, man] = match
  if (!tri && !oku && !million && !man) return null
  return (
    digits(tri) * 1_000_000 + digits(oku) * 100 + digits(million) + digits(man) * 0.01
  )
}

/** ラベルの直後(同じ行か、続く2行以内)を切り出す。 */
function windowAfter(text: string, names: string[]): string | null {
  for (const name of names) {
    let from = 0
    for (;;) {
      const at = text.indexOf(name, from)
      if (at < 0) break
      from = at + name.length
      // 「営業利益率」を「営業利益」として拾わないよう、直後の一文字を見る
      const following = text.slice(from)
      const window = following.split('\n').slice(0, 3).join('\n')
      const match = window.match(NUMBER)
      if (!match || match.index === undefined) continue
      // ラベルと数値の間に別の見出しが挟まっていたら、その数値は別のもの。
      // ただし「PER(会社予想)」のような括弧書きの但し書きは見出しではない。
      const between = window
        .slice(0, match.index)
        .replace(/[（(][^）)]*[）)]/g, '')
        .replace(/[【】\s:：・|]/g, '')
      if (/[ぁ-んァ-ヶ一-龠A-Za-z]{2,}/.test(between)) continue
      return window.slice(match.index)
    }
  }
  return null
}

export type ParsedFundamentals = {
  ratios: Partial<Record<RatioKey, number>>
  statements: Partial<Record<keyof Statements, number>>
}

export function parseFundamentalsText(text: string): ParsedFundamentals {
  const source = text.replace(/\r\n?/g, '\n')
  const ratios: ParsedFundamentals['ratios'] = {}
  const statements: ParsedFundamentals['statements'] = {}

  for (const { key, names } of RATIO_LABELS) {
    const found = windowAfter(source, names)
    const value = found?.match(NUMBER)
    if (value) ratios[key] = Number(value[0].replace(/,/g, ''))
  }

  for (const { key, names } of AMOUNT_LABELS) {
    const found = windowAfter(source, names)
    if (!found) continue
    const million = parseAmountToMillion(found)
    if (million !== null) statements[key] = million
  }

  return { ratios, statements }
}
