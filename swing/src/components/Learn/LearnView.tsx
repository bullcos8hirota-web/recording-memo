import { useMemo, useState } from 'react'
import { CATEGORY_LABEL, searchTerms, TERMS, type TermCategory } from '../../lib/learn/glossary'
import { buildSampleData } from '../../lib/market/sampleData'
import { closes, sma } from '../../lib/market/indicators'
import { CandleChart } from '../Symbol/CandleChart'
import { useGlossary } from './glossaryContext'
import { TermChip, TermLink } from './HelpButton'
import { BuffettSection } from './BuffettSection'
import { WeeklySection } from './WeeklySection'
import { QuizSection } from './QuizSection'
import { useAppStore } from '../../stores/appStore'
import { yen } from '../../lib/format'
import { Card, inputClass } from '../ui/Primitives'
import { useRegisterSwipeStep } from '../../lib/swipeStepContext'
import { useActiveChipScroll } from '../../lib/useActiveChipScroll'

const SECTIONS = [
  { id: 'flow', label: '流れ' },
  { id: 'weekly', label: '週の進め方' },
  { id: 'chart', label: 'チャート' },
  { id: 'money', label: '資金管理' },
  { id: 'buffett', label: 'バフェット' },
  { id: 'glossary', label: '用語集' },
  { id: 'quiz', label: 'クイズ' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

export function LearnView({ onGoTab }: { onGoTab: (tab: 'screener' | 'settings') => void }) {
  const [section, setSection] = useState<SectionId>('flow')

  // 横フリックで隣の章へ。端では止める。
  useRegisterSwipeStep((direction) => {
    const index = SECTIONS.findIndex((item) => item.id === section)
    const next = SECTIONS[index + direction]
    if (next) setSection(next.id)
  })
  const chips = useActiveChipScroll(section)

  return (
    <div className="space-y-4">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1" data-no-swipe ref={chips}>
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            data-chip={item.id}
            onClick={() => setSection(item.id)}
            className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
              section === item.id
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {section === 'flow' && <FlowSection onGoTab={onGoTab} />}
      {section === 'weekly' && <WeeklySection />}
      {section === 'chart' && <ChartSection />}
      {section === 'money' && <MoneySection />}
      {section === 'buffett' && <BuffettSection />}
      {section === 'glossary' && <GlossarySection />}
      {section === 'quiz' && <QuizSection />}
    </div>
  )
}

/* ------------------------------------------------------------------ 流れ */

const STEPS: { title: string; body: string; terms: string[] }[] = [
  {
    title: '1. 使えるお金と、1回で失ってよい額を決める',
    body: '株の勝敗は当てられませんが、負けたときの金額は自分で決められます。資金の1〜2%を上限にすると、10回連続で外しても資金の8割は残ります。ここを決めないと、あとの計算が全部できません。',
    terms: ['risk-per-trade', 'drawdown'],
  },
  {
    title: '2. 上昇トレンドの銘柄を探す',
    body: '下げている株を「安いから」と買うのは、逆走している電車に飛び乗るようなものです。株価が25日線の上にあり、25日線が75日線の上にある銘柄を選びます。監視タブのスコアはこの並びを点数にしたものです。',
    terms: ['trend', 'moving-average'],
  },
  {
    title: '3. 買う場所を待つ',
    body: '良い銘柄でも、上がりきった直後に買うと高値掴みになります。狙うのは「25日線まで下げてきて止まったところ(押し目)」か「直近1か月の高値を出来高を伴って抜けたところ(ブレイク)」の2つです。',
    terms: ['pullback', 'breakout', 'volume'],
  },
  {
    title: '4. 損切り価格を先に決めて、株数を逆算する',
    body: '「ここを割ったら間違いだった」と言える価格を決めます。買値との差が1株あたりのリスク。1回で失ってよい額をその差で割れば、買ってよい株数が出ます。買いたい金額から決めてはいけません。',
    terms: ['stop-loss', 'position-sizing', 'atr'],
  },
  {
    title: '5. 注文を出したら、決めたとおりに動く',
    body: '買いと同時に逆指値(損切り注文)を入れておけば、下げ始めても迷いません。利確は損切り幅の2倍を目安にします。上げが続くなら、損切り価格を引き上げながら追いかけます。',
    terms: ['stop-order', 'take-profit', 'trailing-stop'],
  },
  {
    title: '6. 結果を記録して、次に活かす',
    body: '1回ごとの勝ち負けは運の要素が大きく、20〜30回まとめて見ないと自分の傾向は分かりません。勝率よりも「平均利益 ÷ 平均損失」を見てください。1を切っていたら、利確が早すぎるか損切りが遅すぎます。',
    terms: ['win-rate', 'payoff-ratio', 'expectancy', 'r-multiple'],
  },
]

function FlowSection({ onGoTab }: { onGoTab: (tab: 'screener' | 'settings') => void }) {
  return (
    <div className="space-y-4">
      <Card title="スイングトレードとは" description="数日から数週間かけて売買するやり方です。">
        <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          1日中チャートを見ていられなくても、取引時間が終わったあとに翌日の作戦を立てておけば実行できます。
          その代わり、翌朝に前日と離れた価格で始まる<TermLink term="gap">窓</TermLink>のリスクを毎晩持ち越します。
          だから「いくらまで下がったら諦めるか」を買う前に決めるのが、この手法の生命線です。
        </p>
        <p className="mt-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          このアプリは、下の6ステップを毎回同じ順番でやらせるための道具です。
          用語に下線が引いてあるところと「?」ボタンは、押すと意味が出ます。
          チャートではなく企業の中身から選ぶ考え方(バフェット流)は、上の「バフェット」タブにまとめています。
        </p>
      </Card>

      {STEPS.map((step) => (
        <Card key={step.title}>
          <h3 className="font-semibold">{step.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
            {step.body}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {step.terms.map((id) => (
              <TermChip key={id} id={id} />
            ))}
          </div>
        </Card>
      ))}

      <Card title="まず何をすればいい?">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-neutral-700 dark:text-neutral-300">
          <li>
            「設定」タブでサンプルデータを読み込む(架空の銘柄なので、いくら操作しても損はしません)
            <button
              type="button"
              onClick={() => onGoTab('settings')}
              className="ml-2 rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
            >
              設定タブへ
            </button>
          </li>
          <li>「監視」タブで5銘柄のスコアを見比べる。点数の違いがどこから来ているか、銘柄タブで確かめる</li>
          <li>「銘柄」タブの売買プランで、損切り価格を上下させて株数がどう変わるか試す</li>
          <li>慣れたら、自分が気になっている実際の銘柄を登録して株価データを入れる</li>
        </ol>
        <button
          type="button"
          onClick={() => onGoTab('screener')}
          className="mt-3 text-sm underline decoration-dotted underline-offset-2"
        >
          監視タブを開く
        </button>
      </Card>
    </div>
  )
}

/* -------------------------------------------------------------- チャート */

const PATTERNS: { code: string; title: string; verdict: string; body: string; points: string[]; terms: string[] }[] = [
  {
    code: 'SMPL1',
    title: '押し目 — 買い場を探すならこの形',
    verdict: '狙いやすい',
    body: '上げてきた株が25日線(青)あたりまで下げて、そこで止まっている状態です。トレンドが続くなら、ここが一番安く買える場所になります。',
    points: [
      '25日線が75日線より上にあり、株価がその上に戻っている',
      '下げが25日線あたりで止まっている(乖離が±3%以内)',
      '損切りは25日線の少し下、または直近5日の安値の下に置く',
    ],
    terms: ['pullback', 'moving-average', 'deviation'],
  },
  {
    code: 'SMPL2',
    title: 'ブレイク — 高値を抜けた瞬間',
    verdict: '出来高しだい',
    body: 'しばらく同じ範囲で動いていた株が、直近1か月の高値を超えた状態です。出来高が普段より大きく増えているかが分かれ目になります。',
    points: [
      '前日までの20日高値を、終値で超えている',
      '出来高が20日平均の1.5倍以上あると本物になりやすい',
      '抜けた高値の少し下まで戻ったら、失敗と判断して損切りする',
    ],
    terms: ['breakout', 'volume', 'high-low'],
  },
  {
    code: 'SMPL3',
    title: '下降トレンド — 手を出さない形',
    verdict: '見送り',
    body: '株価が25日線の下にあり、25日線も75日線の下にあります。「だいぶ下がったからそろそろ」と買いたくなりますが、下げ止まりを当てるのは上級者でも難しい領域です。',
    points: [
      '安値も高値も切り下がっている',
      'RSIが30を切っていても、下げ続けることはよくある',
      '買うなら、下げ止まって25日線を上に抜けてからでも遅くない',
    ],
    terms: ['trend', 'rsi'],
  },
  {
    code: 'SMPL4',
    title: 'レンジ — 方向が出ていない',
    verdict: '様子見',
    body: '一定の幅を行ったり来たりしている状態です。上下どちらに抜けるか分からないので、スイングでは基本的に見送ります。抜けたのを確認してから入れば十分です。',
    points: [
      '移動平均が横ばいで、株価がその上下を往復している',
      '値動きが小さい期間は、次に大きく動く準備期間でもある',
      'ボリンジャーバンドが狭まっていたら、動き出しに注意しておく',
    ],
    terms: ['trend', 'bollinger', 'volatility'],
  },
]

function ChartSection() {
  const samples = useMemo(() => {
    const map = new Map(buildSampleData().map((s) => [s.stock.code, s.bars]))
    return PATTERNS.map((pattern) => ({ ...pattern, bars: map.get(pattern.code) ?? [] }))
  }, [])

  return (
    <div className="space-y-4">
      <Card title="チャートの4つの型" description="サンプルデータで、実際の形を見ながら覚えます。実在の銘柄ではありません。">
        <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          オレンジが5日線、青が25日線、紫が75日線です。ローソク足は赤が上げた日、青が下げた日。
          下の棒グラフが<TermLink term="volume">出来高</TermLink>です。
        </p>
      </Card>

      {samples.map((pattern) => {
        const values = closes(pattern.bars)
        return (
          <Card key={pattern.code}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold">{pattern.title}</h3>
              <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                {pattern.verdict}
              </span>
            </div>
            <div className="mt-3">
              <CandleChart
                bars={pattern.bars}
                visibleBars={50}
                overlays={[
                  { label: '5日線', color: '#f59e0b', values: sma(values, 5) },
                  { label: '25日線', color: '#2563eb', values: sma(values, 25) },
                  { label: '75日線', color: '#a855f7', values: sma(values, 75) },
                ]}
              />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
              {pattern.body}
            </p>
            <ul className="mt-3 space-y-1.5">
              {pattern.points.map((point) => (
                <li key={point} className="flex gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                  <span className="text-neutral-400">・</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              {pattern.terms.map((id) => (
                <TermChip key={id} id={id} />
              ))}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------ 資金管理 */

function MoneySection() {
  const capital = useAppStore((s) => s.settings.capital)
  const settingRisk = useAppStore((s) => s.settings.riskPercent)
  const [risk, setRisk] = useState(settingRisk)
  const [losses, setLosses] = useState(10)

  const remaining = capital * (1 - risk / 100) ** losses
  const lost = capital - remaining
  const recovery = remaining > 0 ? (capital / remaining - 1) * 100 : 0

  return (
    <div className="space-y-4">
      <Card
        title="なぜ「1回で失ってよい額」から決めるのか"
        description="連敗しても再挑戦できる資金を残すためです。"
      >
        <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          株で退場する人の多くは、当て続けられなかったからではなく、1回の失敗が大きすぎて次が打てなくなったからです。
          減った資金を元に戻すのは、減らすときよりずっと大変になります。50%失ったら、元に戻すには残った資金を100%増やさなければいけません。
        </p>
        <p className="mt-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          下のスライダーで、連敗したときに何が起きるかを確かめてください。
        </p>

        <div className="mt-4 space-y-4">
          <label className="block text-sm">
            <span className="text-neutral-600 dark:text-neutral-300">
              1回で失う割合: <strong className="tabular-nums">{risk.toFixed(1)}%</strong>(
              {yen((capital * risk) / 100)})
            </span>
            <input
              type="range"
              min={0.5}
              max={10}
              step={0.5}
              value={risk}
              onChange={(e) => setRisk(Number(e.target.value))}
              className="mt-2 w-full accent-neutral-900 dark:accent-neutral-100"
            />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-600 dark:text-neutral-300">
              連敗の回数: <strong className="tabular-nums">{losses}回</strong>
            </span>
            <input
              type="range"
              min={1}
              max={20}
              step={1}
              value={losses}
              onChange={(e) => setLosses(Number(e.target.value))}
              className="mt-2 w-full accent-neutral-900 dark:accent-neutral-100"
            />
          </label>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-neutral-50 px-3 py-2 dark:bg-neutral-800/60">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">残る資金</div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums">{yen(remaining)}</div>
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
              最初の{((remaining / capital) * 100).toFixed(0)}%
            </div>
          </div>
          <div className="rounded-xl bg-neutral-50 px-3 py-2 dark:bg-neutral-800/60">
            <div className="text-xs text-neutral-500 dark:text-neutral-400">元に戻すには</div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums">+{recovery.toFixed(0)}%</div>
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {yen(lost)}の負けを取り返す
            </div>
          </div>
        </div>

        <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
          1回2%なら10連敗しても8割が残り、+22%で戻せます。1回10%なら10連敗で3分の1になり、
          元に戻すには+187%が必要です。同じ「10連敗」でも、決め方でこれだけ変わります。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <TermChip id="risk-per-trade" />
          <TermChip id="position-sizing" />
          <TermChip id="drawdown" />
        </div>
      </Card>

      <Card title="勝率とリスクリワードの関係" description="勝率が低くても勝てる理由です。">
        <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          1回の負けを1、勝ちの大きさをその何倍にできるかで、必要な勝率が変わります。
          損切り幅の2倍を利確目標にすれば、3回に1回強しか当たらなくても資金は減りません。
        </p>
        <div className="mt-3 overflow-x-auto" data-no-swipe>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-neutral-500 dark:text-neutral-400">
              <tr>
                <th className="py-2 pr-3 font-medium">リスクリワード</th>
                <th className="py-2 pr-3 font-medium">損益ゼロに必要な勝率</th>
                <th className="py-2 font-medium">勝率50%なら</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 tabular-nums dark:divide-neutral-800">
              {[1, 1.5, 2, 3].map((rr) => (
                <tr key={rr}>
                  <td className="py-2 pr-3">1 : {rr.toFixed(1)}</td>
                  <td className="py-2 pr-3">{((1 / (1 + rr)) * 100).toFixed(0)}%</td>
                  <td className="py-2">
                    1回あたり +{((0.5 * rr - 0.5) * 100).toFixed(0)}%R
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <TermChip id="risk-reward" />
          <TermChip id="win-rate" />
          <TermChip id="expectancy" />
          <TermChip id="r-multiple" />
        </div>
      </Card>
    </div>
  )
}

/* -------------------------------------------------------------- 用語集 */

function GlossarySection() {
  const { openTerm } = useGlossary()
  const [query, setQuery] = useState('')
  const results = useMemo(() => searchTerms(query), [query])

  const grouped = useMemo(() => {
    const map = new Map<TermCategory, typeof TERMS>()
    for (const term of results) {
      const list = map.get(term.category) ?? []
      list.push(term)
      map.set(term.category, list)
    }
    return [...map.entries()]
  }, [results])

  return (
    <div className="space-y-4">
      <Card title={`用語集(${TERMS.length}語)`} description="分からない言葉が出てきたら、ここか各画面の「?」から。">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="用語を検索(例: 損切り、RSI)"
          className={inputClass}
        />
      </Card>

      {grouped.length === 0 && (
        <Card>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            見つかりませんでした。別の言葉で探してみてください。
          </p>
        </Card>
      )}

      {grouped.map(([category, terms]) => (
        <Card key={category} title={CATEGORY_LABEL[category]}>
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {terms.map((term) => (
              <li key={term.id}>
                <button
                  type="button"
                  onClick={() => openTerm(term.id)}
                  className="w-full py-3 text-left transition active:bg-neutral-100 dark:active:bg-neutral-800"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium">{term.term}</span>
                    {term.reading && (
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        {term.reading}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-neutral-600 dark:text-neutral-400">{term.short}</p>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  )
}
