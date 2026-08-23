/**
 * バフェットが重視すると語ってきた観点を、個人が入手できる数字に落として
 * 判定する。合格/不合格を決めるためではなく、「どこを見ればいいか」を
 * 覚えるための道具として使う。基準値はあくまで一般的な目安。
 */
export type Fundamentals = {
  /** ROE(自己資本利益率, %)。 */
  roe: number | null
  /** 営業利益率(%)。 */
  operatingMargin: number | null
  /** 自己資本比率(%)。 */
  equityRatio: number | null
  /** EPSの年平均成長率(%)。 */
  epsGrowth: number | null
  /** 有利子負債 ÷ 営業利益(年)。実質無借金ならマイナスでもよい。 */
  debtToProfit: number | null
  /** PER(倍)。 */
  per: number | null
  /** PBR(倍)。 */
  pbr: number | null
  /** 直近のフリーキャッシュフローがプラスか。 */
  fcfPositive: boolean | null
}

/**
 * 決算に載っている金額から、比率を計算する。
 * ROEや自己資本比率は「載っていないサイトが多いが、金額からは出せる」ため。
 * 単位は揃っていれば何でもよい(百万円でも億円でも比率は変わらない)。
 */
export type Statements = {
  /** 売上高。 */
  revenue: number | null
  /** 営業利益。 */
  operatingProfit: number | null
  /** 純利益(親会社株主に帰属する当期純利益)。 */
  netProfit: number | null
  /** 自己資本(純資産)。 */
  equity: number | null
  /** 総資産。 */
  assets: number | null
  /** 有利子負債(借入金と社債の合計)。 */
  debt: number | null
}

export const EMPTY_STATEMENTS: Statements = {
  revenue: null,
  operatingProfit: null,
  netProfit: null,
  equity: null,
  assets: null,
  debt: null,
}

const divide = (top: number | null, bottom: number | null): number | null =>
  top === null || bottom === null || bottom === 0 ? null : top / bottom

const asPercent = (top: number | null, bottom: number | null): number | null => {
  const value = divide(top, bottom)
  return value === null ? null : Math.round(value * 1000) / 10
}

export function fromStatements(
  statements: Statements,
): Pick<Fundamentals, 'roe' | 'operatingMargin' | 'equityRatio' | 'debtToProfit'> {
  const { revenue, operatingProfit, netProfit, equity, assets, debt } = statements
  const years = divide(debt, operatingProfit)
  return {
    roe: asPercent(netProfit, equity),
    operatingMargin: asPercent(operatingProfit, revenue),
    equityRatio: asPercent(equity, assets),
    debtToProfit: years === null ? null : Math.round(years * 10) / 10,
  }
}

export const EMPTY_FUNDAMENTALS: Fundamentals = {
  roe: null,
  operatingMargin: null,
  equityRatio: null,
  epsGrowth: null,
  debtToProfit: null,
  per: null,
  pbr: null,
  fcfPositive: null,
}

export type Verdict = 'good' | 'ok' | 'weak' | 'unknown'

export type Check = {
  id: string
  label: string
  /** 用語集のID。 */
  term: string
  /** 目安の説明。 */
  target: string
  /** なぜバフェットがそこを見るのか。 */
  why: string
  verdict: Verdict
  /** 入力値の表示。 */
  display: string
  /** 判定に対するひとこと。 */
  comment: string
}

const grade = (
  value: number | null,
  good: (v: number) => boolean,
  ok: (v: number) => boolean,
): Verdict => {
  if (value === null || !Number.isFinite(value)) return 'unknown'
  if (good(value)) return 'good'
  if (ok(value)) return 'ok'
  return 'weak'
}

const percent = (value: number | null): string =>
  value === null ? '未入力' : `${value.toFixed(1)}%`

export function evaluateFundamentals(input: Fundamentals): {
  checks: Check[]
  /** 0〜100。入力した項目だけで計算する。 */
  score: number | null
  answered: number
  earningsYield: number | null
  grahamNumber: number | null
  summary: string
} {
  const checks: Check[] = []

  const roeVerdict = grade(input.roe, (v) => v >= 15, (v) => v >= 10)
  checks.push({
    id: 'roe',
    label: 'ROE(自己資本利益率)',
    term: 'roe',
    target: '15%以上が続いていれば良い',
    why: '株主のお金を効率よく増やせている証拠。何年も高いままなら、他社が真似できない強みがある可能性が高い。',
    verdict: roeVerdict,
    display: percent(input.roe),
    comment:
      roeVerdict === 'good'
        ? '高水準。ただし1年だけでなく、5〜10年続いているかを確認してください。'
        : roeVerdict === 'ok'
          ? '悪くない水準。伸びているか、下がってきているかを見てください。'
          : roeVerdict === 'weak'
            ? '資本を活かしきれていない可能性があります。'
            : '未入力です。',
  })

  const marginVerdict = grade(input.operatingMargin, (v) => v >= 15, (v) => v >= 8)
  checks.push({
    id: 'operating-margin',
    label: '営業利益率',
    term: 'operating-margin',
    target: '10%以上、業種内で高いほど良い',
    why: '値段を自分で決められる力(価格決定力)の表れ。値下げ競争をしている会社は利益率が低くなる。',
    verdict: marginVerdict,
    display: percent(input.operatingMargin),
    comment:
      marginVerdict === 'good'
        ? '価格決定力がある可能性があります。同業他社と比べてみてください。'
        : marginVerdict === 'ok'
          ? '平均的です。業種によってはこれで十分な場合もあります。'
          : marginVerdict === 'weak'
            ? '薄利です。競争が激しい業界かもしれません。'
            : '未入力です。',
  })

  const equityVerdict = grade(input.equityRatio, (v) => v >= 50, (v) => v >= 35)
  checks.push({
    id: 'equity-ratio',
    label: '自己資本比率',
    term: 'equity-ratio',
    target: '50%以上なら健全',
    why: '借金が少ないほど、不況のときに選択肢が残る。バフェットが借金の多い会社を避ける理由。',
    verdict: equityVerdict,
    display: percent(input.equityRatio),
    comment:
      equityVerdict === 'good'
        ? '財務は堅い部類です。'
        : equityVerdict === 'ok'
          ? '標準的です。銀行・商社・電力などは業種の性質上低くなります。'
          : equityVerdict === 'weak'
            ? '借入が多めです。業績が落ちたときに耐えられるか確認を。'
            : '未入力です。',
  })

  const growthVerdict = grade(input.epsGrowth, (v) => v >= 10, (v) => v >= 5)
  checks.push({
    id: 'eps-growth',
    label: 'EPS成長率(年率)',
    term: 'eps',
    target: '毎年伸びていること',
    why: '1株が稼ぐ額が増え続けているか。水準より「10年間、右肩上がりか」が大事。',
    verdict: growthVerdict,
    display: percent(input.epsGrowth),
    comment:
      growthVerdict === 'good'
        ? 'よく伸びています。一時的な特需でないかを確認してください。'
        : growthVerdict === 'ok'
          ? '緩やかに伸びています。'
          : growthVerdict === 'weak'
            ? '伸びていません。理由が一時的なものか、構造的なものかを調べてください。'
            : '未入力です。',
  })

  const debtVerdict = grade(input.debtToProfit, (v) => v <= 3, (v) => v <= 6)
  checks.push({
    id: 'debt',
    label: '有利子負債 ÷ 営業利益',
    term: 'debt-to-profit',
    target: '3〜4年分以内',
    why: '借金を本業の利益で何年で返せるか。返済に追われる会社は、良い機会が来ても動けない。',
    verdict: debtVerdict,
    display: input.debtToProfit === null ? '未入力' : `${input.debtToProfit.toFixed(1)}年分`,
    comment:
      debtVerdict === 'good'
        ? '無理のない借入水準です。'
        : debtVerdict === 'ok'
          ? '返せる範囲ですが、金利が上がると負担が増えます。'
          : debtVerdict === 'weak'
            ? '重い借金です。利益が落ちると一気に苦しくなります。'
            : '未入力です。',
  })

  const perVerdict = grade(input.per, (v) => v > 0 && v <= 15, (v) => v > 0 && v <= 25)
  checks.push({
    id: 'per',
    label: 'PER(株価収益率)',
    term: 'per',
    target: '成長率と見合っているか',
    why: '同じ会社でも、高く買えば儲からない。「素晴らしい会社を、そこそこの価格で」が基本方針。',
    verdict: perVerdict,
    display: input.per === null ? '未入力' : `${input.per.toFixed(1)}倍`,
    comment:
      perVerdict === 'good'
        ? '割高ではありません。ただし安いのには理由がある場合も。'
        : perVerdict === 'ok'
          ? '成長が続くなら許容範囲です。'
          : perVerdict === 'weak'
            ? '期待が織り込まれています。成長が止まると下落幅が大きくなります。'
            : '未入力です。',
  })

  const fcfVerdict: Verdict =
    input.fcfPositive === null ? 'unknown' : input.fcfPositive ? 'good' : 'weak'
  checks.push({
    id: 'fcf',
    label: 'フリーキャッシュフロー',
    term: 'free-cash-flow',
    target: 'プラスであること',
    why: '利益は会計上の判断で動くが、現金は誤魔化しにくい。配当や自社株買いの原資でもある。',
    verdict: fcfVerdict,
    display: input.fcfPositive === null ? '未入力' : input.fcfPositive ? 'プラス' : 'マイナス',
    comment:
      fcfVerdict === 'good'
        ? '本業で現金を稼げています。'
        : fcfVerdict === 'weak'
          ? '成長のための投資が理由ならよいですが、続くようなら要注意です。'
          : '未入力です。',
  })

  const answered = checks.filter((check) => check.verdict !== 'unknown').length
  const points = checks.reduce(
    (total, check) => total + (check.verdict === 'good' ? 2 : check.verdict === 'ok' ? 1 : 0),
    0,
  )
  const score = answered === 0 ? null : Math.round((points / (answered * 2)) * 100)

  const earningsYield = input.per && input.per > 0 ? 100 / input.per : null
  const grahamNumber = input.per && input.pbr ? input.per * input.pbr : null

  return {
    checks,
    score,
    answered,
    earningsYield,
    grahamNumber,
    summary: summarize(score, answered),
  }
}

function summarize(score: number | null, answered: number): string {
  if (score === null) return '数字を入力すると、どこを見ればよいかが分かります。'
  if (answered < 4) return 'まだ入力が少ないため、参考程度に見てください。'
  if (score >= 80) return 'バフェットが好むタイプの数字が並んでいます。次は「その強みが10年続くか」を考える番です。'
  if (score >= 60) return '悪くない数字です。弱い項目の理由を調べると、その会社の性格が見えてきます。'
  if (score >= 40) return '長期で持つには確認したい点があります。数字が改善しているのか、悪化しているのかを見てください。'
  return 'バフェット流の基準からは外れています。短期の値動きを狙う対象と、長く持つ対象は分けて考えてください。'
}

/** グレアムが示した「PER × PBR ≦ 22.5」の目安。 */
export function grahamVerdict(value: number | null): Verdict {
  if (value === null) return 'unknown'
  if (value <= 22.5) return 'good'
  if (value <= 40) return 'ok'
  return 'weak'
}
