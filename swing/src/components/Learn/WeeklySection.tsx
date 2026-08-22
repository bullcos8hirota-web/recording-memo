import { Card } from '../ui/Primitives'
import { TermChip, TermLink } from './HelpButton'

const SCHEDULE: { when: string; what: string; detail: string; where: string }[] = [
  {
    when: '土日',
    what: '今週の振り返りと、来週の候補選び',
    detail:
      '記録タブで売り終わったトレードを振り返り、監視タブのスコア順に候補を眺めます。買う場所(押し目・ブレイク)が近いものだけ残します。',
    where: 'アプリ: 記録 → 監視 → 銘柄',
  },
  {
    when: '日曜の夜',
    what: '売買プランを作って、注文を予約する',
    detail:
      'エントリー価格・損切り価格・株数を決めます。SBI証券で買い注文を出し、約定したら損切りの逆指値まで入れておきます。ここまでやれば平日は何もしません。',
    where: 'アプリ: 銘柄 → 売買プラン / SBI証券: 注文',
  },
  {
    when: '月〜金',
    what: '原則、見ない',
    detail:
      '約定の通知が来たら、損切りの逆指値が入っているかだけ確認します。値動きを日中に見ると、決めたルールを破りたくなります。',
    where: 'SBI証券: 注文照会',
  },
  {
    when: '金曜の引け後',
    what: '1週間分の終値をまとめて取り込む',
    detail:
      '銘柄タブで銘柄を選び、時系列ページから今週の5日分をコピーして貼り付けます。建玉タブで損切りラインとの距離を確認します。',
    where: 'アプリ: 銘柄 → 建玉',
  },
  {
    when: '土日',
    what: '結果を踏まえて来週を決める',
    detail:
      '売り終わったなら振り返りを書く。持ち越すなら建玉タブの「トレーリング目安」を見て、今の損切りより上ならそこまで引き上げ、SBI証券の逆指値も同じ値に出し直す。目安が今の損切りより下なら動かさない。次の候補を選び直す。',
    where: 'アプリ: 記録 → 建玉 → 監視',
  },
]

const ORDER_STEPS: { title: string; body: string; check?: string }[] = [
  {
    title: '1. 銘柄と株数を用意する',
    body: 'アプリの売買プランに出る「証券会社に入れる注文」を開きます。銘柄・株数・トリガー価格がそのまま書いてあるので、控えるのはその3つです。株数は許容損失から逆算された数字で、自分の希望額ではありません。',
  },
  {
    title: '2. 「通常」を「逆指値」に切り替える',
    body: '注文入力の画面は、はじめ「通常」が選ばれています。株数を入れる欄の上、市場を選ぶ欄の右に「通常 / 逆指値」の切り替えがあるので、逆指値を押します。ここを切り替えないと、トリガー価格を入れる欄そのものが出てきません。',
    check: '切り替えたあと、画面に「〜円以上になったら」という条件の欄があるか確認。',
  },
  {
    title: '3. トリガー価格を入れて、注文は成行にする',
    body: 'アプリのトリガー価格をそのまま入れ、そのあとに出す注文は成行を選びます。上に抜けたときだけ買う形なので、指値だと抜けた瞬間に置いていかれます。',
    check: '株数と預り区分(特定口座 / NISA)を確認。NISAは損失を他の利益と相殺できません。',
  },
  {
    title: '4. 注文期間を「今週中」にする',
    body: '初期値は「当日中」です。来週まで残らない期間にします。週明けに状況が変わっているのに、古い注文が生きているのは危険です。',
  },
  {
    title: '5. 買えたら、その日のうちに売りの逆指値を出す',
    body: 'アプリの損切り価格で「◯◯円以下になったら成行で売る」を入れます。買い注文と同じように、ここでも「逆指値」への切り替えが要ります。ここが週次運用の生命線です。',
    check: '期間は選べる中で一番長く。期限切れで無防備になるのを防ぎます。',
  },
  {
    title: '6. 毎週末、売りの逆指値を出し直す',
    body: '建玉タブのトレーリング目安が今の損切りより上なら、その値まで引き上げます。アプリで更新しただけでは注文は変わらないので、証券会社の注文も訂正します。目安が下なら何もしません。',
    check: '損切りは上げるだけ。下げると、建てたときに決めた損失より大きく負けます。',
  },
]

export function WeeklySection() {
  return (
    <div className="space-y-4">
      <Card
        title="1週間を1サイクルにする"
        description="日中に相場を見られない人向けの回し方です。"
      >
        <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          スイングトレードは数日〜数週間の値動きを取るので、平日に張り付く必要はありません。
          週末に考えて、日曜に注文を仕込み、金曜にまとめて記録する、という形で回せます。
        </p>
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-semibold">成立させる条件は3つ</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              買ったら必ず<TermLink term="stop-order">逆指値</TermLink>で損切り注文を置く
              (平日見ないなら必須)
            </li>
            <li>
              <TermLink term="earnings">決算発表</TermLink>をまたぐ週は避ける
            </li>
            <li>同時に持つのは1〜2銘柄まで</li>
          </ol>
        </div>
      </Card>

      <Card title="週のスケジュール">
        <ol className="space-y-4">
          {SCHEDULE.map((item) => (
            <li key={item.when} className="border-l-2 border-neutral-200 pl-3 dark:border-neutral-700">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-xs font-medium text-white dark:bg-neutral-100 dark:text-neutral-900">
                  {item.when}
                </span>
                <span className="font-semibold">{item.what}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                {item.detail}
              </p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{item.where}</p>
            </li>
          ))}
        </ol>
      </Card>

      <Card
        title="SBI証券での注文手順"
        description="日曜の夜にやることです。メニュー名や使える注文方法は口座やアプリの版で違うので、初回は画面で確認してください。"
      >
        <ol className="space-y-4">
          {ORDER_STEPS.map((step) => (
            <li key={step.title}>
              <h3 className="font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                {step.body}
              </p>
              {step.check && (
                <p className="mt-1 rounded-lg bg-neutral-100 px-2 py-1 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                  確認: {step.check}
                </p>
              )}
            </li>
          ))}
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <TermChip id="stop-order" />
          <TermChip id="order-type" />
          <TermChip id="tick" />
          <TermChip id="unit-share" />
        </div>
      </Card>

      <Card title="週次でやるときの落とし穴">
        <ul className="space-y-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          <li>
            ・<strong>逆指値を入れ忘れる</strong> —
            これだけで週次運用は破綻します。約定通知が来たら真っ先に確認してください。
          </li>
          <li>
            ・<strong>週の途中で見て、我慢できずに手を出す</strong> —
            見ないと決めたなら見ない。見るなら、決めたルールでしか動かない。
          </li>
          <li>
            ・<strong>金曜に取り込むのを忘れる</strong> —
            記録が途切れると、来週の判断材料がなくなります。カレンダーに予定を入れてください(設定タブ)。
          </li>
          <li>
            ・<strong>持ち越し中に決算が来る</strong> —
            買う前に次の決算発表日を調べ、銘柄メモに書いておきます。
          </li>
        </ul>
      </Card>
    </div>
  )
}
