import { useMemo, useState } from 'react'
import {
  EMPTY_FUNDAMENTALS,
  evaluateFundamentals,
  grahamVerdict,
  type Fundamentals,
  type Verdict,
} from '../../lib/learn/buffett'
import { Card, Field, inputClass, subtleButtonClass } from '../ui/Primitives'
import { HelpButton, TermChip, TermLink } from './HelpButton'

const PRINCIPLES: { title: string; body: string; terms: string[] }[] = [
  {
    title: '1. 自分が理解できる事業か',
    body: 'バフェットは「輪の大きさより、境界がどこにあるかを知っていることが重要だ」と言います。何で儲けているのかを自分の言葉で説明できない会社は買いません。長年ハイテク株を避けたのも、10年後を見通せなかったからです。',
    terms: ['circle-of-competence'],
  },
  {
    title: '2. 他社が真似できない強み(堀)があるか',
    body: '高い利益を出す会社には必ず競合が来ます。ブランド、乗り換えの面倒さ、圧倒的なコスト優位、ネットワーク効果 —— こうした「堀」がないと、利益はいずれ削り取られます。堀の有無は、高い営業利益率とROEが何年も続いているかに表れます。',
    terms: ['moat', 'operating-margin', 'roe'],
  },
  {
    title: '3. 経営者が信頼できるか',
    body: '稼いだお金の使い方を見ます。安いときに自社株を買い戻しているか、無理な多角化で価値を壊していないか。バフェットは「内部留保1ドルにつき、1ドル以上の株主価値を生んでいるか」で経営陣を評価します。',
    terms: ['buyback', 'free-cash-flow'],
  },
  {
    title: '4. 財務が健全か',
    body: '借金の少ない会社を好みます。理由は単純で、借金の多い会社は不況のときに選択肢を失うからです。自己資本比率と、借金を営業利益の何年分で返せるかを見ます。',
    terms: ['equity-ratio', 'debt-to-profit'],
  },
  {
    title: '5. 値段が価値に対して安いか',
    body: 'どんなに良い会社でも、高く買えば儲かりません。企業の価値をざっくり見積もり、それより十分安いときだけ買う —— これが安全余裕率の考え方です。相場は気分屋なので、待っていれば安く売ってくれる日が来ます。',
    terms: ['intrinsic-value', 'margin-of-safety', 'mr-market', 'per'],
  },
]

const VERDICT_STYLE: Record<Verdict, { label: string; className: string }> = {
  good: { label: '良い', className: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' },
  ok: { label: 'まずまず', className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  weak: { label: '弱い', className: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300' },
  unknown: { label: '未入力', className: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400' },
}

const SAMPLE: Fundamentals = {
  roe: 18,
  operatingMargin: 22,
  equityRatio: 62,
  epsGrowth: 11,
  debtToProfit: 1.2,
  per: 16,
  pbr: 2.6,
  fcfPositive: true,
}

export function BuffettSection() {
  const [form, setForm] = useState<Record<string, string>>({})
  const [fcf, setFcf] = useState<'plus' | 'minus' | null>(null)

  const fundamentals = useMemo<Fundamentals>(() => {
    const num = (key: string): number | null => {
      const raw = form[key]
      if (raw === undefined || raw.trim() === '') return null
      const value = Number(raw)
      return Number.isFinite(value) ? value : null
    }
    return {
      ...EMPTY_FUNDAMENTALS,
      roe: num('roe'),
      operatingMargin: num('operatingMargin'),
      equityRatio: num('equityRatio'),
      epsGrowth: num('epsGrowth'),
      debtToProfit: num('debtToProfit'),
      per: num('per'),
      pbr: num('pbr'),
      fcfPositive: fcf === null ? null : fcf === 'plus',
    }
  }, [form, fcf])

  const result = useMemo(() => evaluateFundamentals(fundamentals), [fundamentals])

  const loadSample = () => {
    setForm({
      roe: String(SAMPLE.roe),
      operatingMargin: String(SAMPLE.operatingMargin),
      equityRatio: String(SAMPLE.equityRatio),
      epsGrowth: String(SAMPLE.epsGrowth),
      debtToProfit: String(SAMPLE.debtToProfit),
      per: String(SAMPLE.per),
      pbr: String(SAMPLE.pbr),
    })
    setFcf('plus')
  }

  return (
    <div className="space-y-4">
      <Card
        title="バフェットは何を見ているのか"
        description="チャートではなく、会社そのものを見る投資です。"
      >
        <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          ウォーレン・バフェットのやり方は、株を「値段が上下する記号」ではなく
          <TermLink term="value-investing">会社の一部を持つ権利</TermLink>
          と考えるところから始まります。良い会社を、価値より安い値段で買い、10年単位で持ち続ける。
          売買の回数は極端に少なく、チャートは見ません。
        </p>
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-semibold">このアプリのやり方とは時間軸が正反対です</p>
          <p className="mt-1 leading-relaxed">
            スイングトレードは数日〜数週間、バフェット流は5年〜10年。
            狙っているものも、売る理由も違います。片方の物差しでもう片方を測ると失敗します。
          </p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-neutral-500 dark:text-neutral-400">
              <tr>
                <th className="py-2 pr-3 font-medium">　</th>
                <th className="py-2 pr-3 font-medium">スイングトレード</th>
                <th className="py-2 font-medium">バフェット流</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {[
                ['持つ期間', '数日〜数週間', '5年〜一生'],
                ['判断材料', 'チャートと出来高', '決算書と事業の中身'],
                ['買う理由', '形が整った', '価値より安い'],
                ['売る理由', '損切り・利確に達した', '価値が壊れた・高くなりすぎた'],
                ['下げたとき', '決めた線で撤退する', '価値が同じなら買い増す'],
              ].map(([label, swing, buffett]) => (
                <tr key={label}>
                  <td className="py-2 pr-3 text-neutral-500 dark:text-neutral-400">{label}</td>
                  <td className="py-2 pr-3">{swing}</td>
                  <td className="py-2">{buffett}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          いちばん危ないのは、その2つを途中ですり替えることです。
          短期のつもりで買った株が下がったとき、「長期投資だから」と損切りをやめる——
          これが塩漬けの入口になります。最初にどちらのつもりで買うかを決め、決めた側のルールで手仕舞ってください。
        </p>
        <p className="mt-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          併用するなら「<strong>何を買うか</strong>は企業の中身で絞り、
          <strong>いつ買うか</strong>はチャートで測る」という分け方が現実的です。
          中身の良い会社だけを監視リストに入れ、押し目が来たら入る。
          こうすると、下降トレンドの銘柄を掴む確率が下がります。
        </p>
      </Card>

      <Card title="5つの原則" description="バフェットが繰り返し語ってきた観点です。">
        <div className="space-y-4">
          {PRINCIPLES.map((principle) => (
            <div key={principle.title}>
              <h3 className="font-semibold">{principle.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                {principle.body}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {principle.terms.map((id) => (
                  <TermChip key={id} id={id} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="企業チェッカー"
        description="気になる会社の数字を入れると、バフェットが見る観点でどうなのかを判定します。合否を決める道具ではなく、見る場所を覚えるための練習です。"
        actions={
          <button type="button" className={subtleButtonClass} onClick={loadSample}>
            例を入れる
          </button>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="ROE(%)" help="roe">
            <input
              className={inputClass}
              value={form.roe ?? ''}
              onChange={(e) => setForm({ ...form, roe: e.target.value })}
              inputMode="decimal"
              placeholder="15"
            />
          </Field>
          <Field label="営業利益率(%)" help="operating-margin">
            <input
              className={inputClass}
              value={form.operatingMargin ?? ''}
              onChange={(e) => setForm({ ...form, operatingMargin: e.target.value })}
              inputMode="decimal"
              placeholder="12"
            />
          </Field>
          <Field label="自己資本比率(%)" help="equity-ratio">
            <input
              className={inputClass}
              value={form.equityRatio ?? ''}
              onChange={(e) => setForm({ ...form, equityRatio: e.target.value })}
              inputMode="decimal"
              placeholder="55"
            />
          </Field>
          <Field label="EPS成長率(年率%)" help="eps">
            <input
              className={inputClass}
              value={form.epsGrowth ?? ''}
              onChange={(e) => setForm({ ...form, epsGrowth: e.target.value })}
              inputMode="decimal"
              placeholder="8"
            />
          </Field>
          <Field label="有利子負債÷営業利益(年)" help="debt-to-profit">
            <input
              className={inputClass}
              value={form.debtToProfit ?? ''}
              onChange={(e) => setForm({ ...form, debtToProfit: e.target.value })}
              inputMode="decimal"
              placeholder="2"
            />
          </Field>
          <Field label="PER(倍)" help="per">
            <input
              className={inputClass}
              value={form.per ?? ''}
              onChange={(e) => setForm({ ...form, per: e.target.value })}
              inputMode="decimal"
              placeholder="15"
            />
          </Field>
          <Field label="PBR(倍)" help="pbr">
            <input
              className={inputClass}
              value={form.pbr ?? ''}
              onChange={(e) => setForm({ ...form, pbr: e.target.value })}
              inputMode="decimal"
              placeholder="1.5"
            />
          </Field>
          <div className="text-sm">
            <span className="inline-flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
              フリーCF
              <HelpButton term="free-cash-flow" label="フリーキャッシュフロー" />
            </span>
            <div className="mt-1 flex gap-2">
              {(
                [
                  ['plus', 'プラス'],
                  ['minus', 'マイナス'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFcf(fcf === key ? null : key)}
                  className={`min-h-11 flex-1 rounded-lg border px-2 text-sm transition ${
                    fcf === key
                      ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
                      : 'border-neutral-300 dark:border-neutral-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
          数字の出どころ: SBI証券アプリの銘柄情報(業績・財務)、会社四季報、企業のIRページの決算短信。
          ROEやPER、PBRは銘柄情報にそのまま載っています。
        </p>

        <div className="mt-4 rounded-2xl bg-neutral-50 p-3 dark:bg-neutral-800/60">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                入力した{result.answered}項目での評価
              </div>
              <div className="text-2xl font-semibold tabular-nums">
                {result.score === null ? '—' : `${result.score}点`}
              </div>
            </div>
            {result.earningsYield !== null && (
              <div className="text-right">
                <div className="text-xs text-neutral-500 dark:text-neutral-400">益回り(1÷PER)</div>
                <div className="text-lg font-semibold tabular-nums">
                  {result.earningsYield.toFixed(1)}%
                </div>
              </div>
            )}
          </div>
          <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">{result.summary}</p>
          {result.grahamNumber !== null && (
            <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              PER × PBR = {result.grahamNumber.toFixed(1)}
              （グレアムの目安は22.5以下 →{' '}
              {VERDICT_STYLE[grahamVerdict(result.grahamNumber)].label}）
            </p>
          )}
        </div>

        <ul className="mt-3 space-y-2">
          {result.checks.map((check) => (
            <li
              key={check.id}
              className="rounded-xl border border-neutral-200 px-3 py-2.5 dark:border-neutral-800"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{check.label}</span>
                <HelpButton term={check.term} label={check.label} />
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${VERDICT_STYLE[check.verdict].className}`}
                >
                  {VERDICT_STYLE[check.verdict].label}
                </span>
                <span className="tabular-nums text-sm">{check.display}</span>
              </div>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                目安: {check.target}
              </p>
              <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{check.why}</p>
              {check.verdict !== 'unknown' && (
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  → {check.comment}
                </p>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="そのまま真似できない点" description="鵜呑みにしないための注意書きです。">
        <ul className="space-y-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          <li>
            ・バフェットは会社を丸ごと買えます。経営に口を出せる立場と、100株持つ個人とでは条件が違います。
          </li>
          <li>
            ・保険事業で預かった資金(フロート)を使えるという、個人にはない元手の強みがあります。
          </li>
          <li>
            ・ここに挙げた基準値は一般的な目安です。銀行・商社・不動産などは自己資本比率の水準がまったく違い、同じ物差しでは測れません。同業他社と比べてください。
          </li>
          <li>
            ・過去10年の数字が良くても、将来を保証しません。数字は「その会社を調べる出発点」であって、結論ではありません。
          </li>
          <li>
            ・彼自身、指標を機械的には使っていません。「だいたい正しいほうが、正確に間違うよりいい」という言い方をします。
          </li>
        </ul>
      </Card>
    </div>
  )
}
