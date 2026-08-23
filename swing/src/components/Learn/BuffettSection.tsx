import { Card } from '../ui/Primitives'
import { TermChip, TermLink } from './HelpButton'

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

export function BuffettSection() {
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
        <div className="mt-3 overflow-x-auto" data-no-swipe>
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
