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

/**
 * SBI証券のスマホ用注文画面(s.sbisec.co.jp)の欄そのままの順に並べる。
 * 手順を文章で書くより、画面と1対1で対応させたほうが迷わない。
 */
const BUY_FIELDS: { field: string; value: string; note?: string }[] = [
  { field: '現物 / 信用', value: '現物' },
  { field: '買 / 売', value: '買' },
  { field: '市場', value: '東証', note: 'SORは逆指値では選べないため、自動で東証になります。' },
  {
    field: '通常 / 逆指値',
    value: '逆指値',
    note: 'ここを切り替えないと「条件」の欄が出てきません。',
  },
  { field: '株数', value: 'アプリの株数', note: '売買プランの「証券会社に入れる注文」の数字。' },
  { field: '条件', value: 'アプリのトリガー価格' },
  {
    field: '以上になったら / 以下になったら',
    value: '以上になったら',
    note: '上に抜けたときだけ買う注文なので「以上」。',
  },
  {
    field: '指値 / 成行',
    value: '成行',
    note: '抜けた瞬間に買うため。指値だと置いていかれます。',
  },
  { field: '無条件 / 寄成 / 引成 / IOC成行', value: '無条件' },
  { field: '期間', value: '今週中', note: '初期値は「当日中」。来週に持ち越さないため。' },
  { field: '預り区分', value: '特定預り', note: 'NISAは損失を他の利益と相殺できません。' },
  { field: '取引パスワード', value: '入力して「確認」' },
]

const SELL_FIELDS: { field: string; value: string; note?: string }[] = [
  { field: '現物 / 信用', value: '現物' },
  { field: '買 / 売', value: '売', note: '買い注文と違うのはここから。' },
  { field: '通常 / 逆指値', value: '逆指値' },
  { field: '株数', value: '買えた株数と同じ' },
  { field: '条件', value: 'アプリの損切り価格' },
  {
    field: '以上になったら / 以下になったら',
    value: '以下になったら',
    note: '下がったら売る注文なので「以下」。買いと逆です。',
  },
  { field: '指値 / 成行', value: '成行' },
  { field: '期間', value: '選べる中で一番長く', note: '期限切れで無防備になるのを防ぎます。' },
  { field: '預り区分', value: '特定預り' },
  { field: '取引パスワード', value: '入力して「確認」' },
]

function FieldTable({ rows }: { rows: { field: string; value: string; note?: string }[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {rows.map((row) => (
            <tr key={row.field}>
              <td className="w-2/5 px-3 py-2 align-top text-neutral-500 dark:text-neutral-400">
                {row.field}
              </td>
              <td className="px-3 py-2 align-top">
                <span className="font-medium">{row.value}</span>
                {row.note && (
                  <span className="mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">
                    {row.note}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

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
        description="スマホの注文画面に出てくる欄の順に並べています。上から埋めれば1件の注文になります。"
      >
        <h3 className="font-semibold">買い注文（週明けに出す）</h3>
        <p className="mt-1 mb-2 text-sm text-neutral-600 dark:text-neutral-300">
          出した時点では約定しません。株価が条件の値まで上がって初めて成立します。
        </p>
        <FieldTable rows={BUY_FIELDS} />

        <h3 className="mt-5 font-semibold">売りの損切り注文（買えた日に出す）</h3>
        <p className="mt-1 mb-2 text-sm text-neutral-600 dark:text-neutral-300">
          買えたその日のうちに出します。ここまでやって1セットです。
          利確の注文は出しません（毎週末、この注文を上に出し直していきます）。
        </p>
        <FieldTable rows={SELL_FIELDS} />

        <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-300">
          毎週末、建玉タブのトレーリング目安が今の損切りより上なら、この売り注文を訂正して
          その値に上げます。アプリで更新しただけでは注文は変わりません。目安が下なら何もしません。
          損切りは上げるだけです。
        </p>

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
