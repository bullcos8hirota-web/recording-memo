import { useAppStore } from '../../stores/appStore'
import { MIN_ATR_RATE, MIN_PRICE, universeFor } from '../../lib/money/universe'
import { yen } from '../../lib/format'
import { Card } from '../ui/Primitives'
import { TermChip } from './HelpButton'

const money = (value: number): string => `${Math.round(value).toLocaleString('ja-JP')}円`

/**
 * 何を監視リストに入れるか。資金と許容損失から範囲が決まるので、設定から計算して出す。
 * 買えない銘柄を毎週取り込んで判断するのは、そのまま時間の無駄になる。
 */
export function PickingSection() {
  const settings = useAppStore((s) => s.settings)
  const lot = settings.defaultLot
  const universe = universeFor(settings)
  const budget = (settings.capital * settings.riskPercent) / 100
  const positionCap = (settings.capital * settings.maxPositionPercent) / 100

  return (
    <div className="space-y-4">
      <Card
        title="あなたの設定で買える範囲"
        description={`資金${yen(settings.capital)} / 1トレード${settings.riskPercent}% / 1銘柄上限${settings.maxPositionPercent}% / ${lot}株単位から計算しています。`}
      >
        <dl className="divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
          <Row
            label="株価の上限"
            value={money(universe.priceCap)}
            note={`1単元が${money(positionCap)}に収まるのは${money(universe.priceCapByPosition)}まで。さらに「動く銘柄」の条件と両立するのが${money(universe.priceCapByAtr)}まで。`}
          />
          <Row
            label="ATRの上限"
            value={money(universe.atrCap)}
            note={`損切り幅はATRの${settings.atrMultiple}倍。${lot}株で許容損失${money(budget)}に収めるとこの値になります。`}
          />
          <Row
            label="ATR率の下限"
            value={`${MIN_ATR_RATE}%`}
            note="1日の値幅が終値のこれ未満だと、利確まで何週間もかかります。動かない銘柄は待つ意味がありません。"
          />
          <Row
            label="株価の下限"
            value={money(MIN_PRICE)}
            note="これ未満は呼値が粗く、損切り価格を細かく置けません。"
          />
          <Row
            label="1日の売買代金"
            value={`${money(universe.turnoverFloor)}以上`}
            note="建玉が1日の売買代金の1%を超えると、自分の注文で値段が動きます。"
          />
        </dl>
        <p className="mt-3 text-sm font-medium">
          探すのは 株価{money(MIN_PRICE)}〜{money(universe.priceCap)} / ATR{MIN_ATR_RATE}%以上 の銘柄です。
        </p>
      </Card>

      <Card title="そのうえで、形を見る" description="範囲に入っていることは前提で、買う場所はチャートで決めます。">
        <ul className="space-y-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          <li>・終値が25日線より上。25日線自体が上を向いている</li>
          <li>・25日線が75日線より上（中期も上向き）</li>
          <li>・押し目（25日線まで下げて止まった）か、ブレイク（20日高値を超えた）のどちらか</li>
          <li>・その日の出来高が20日平均以上。細い上放れは続きません</li>
          <li>・RSIが70未満。すでに買われすぎなら、次の押し目まで待つ</li>
          <li>・2週間以内に決算発表や権利確定日が無い</li>
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <TermChip id="atr" />
          <TermChip id="moving-average" />
          <TermChip id="volume" />
          <TermChip id="rsi" />
        </div>
      </Card>

      <Card title="何銘柄を見るか" description="監視リストの数が、そのまま機会の数になります。">
        <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          押し目やブレイクは、1銘柄あたり月に1〜2回しか来ません。
          5銘柄では月に数回、条件まで揃うのは1回あるかどうかです。
          「何もしない週」が続くのは、手法ではなく銘柄数の問題であることが多いです。
        </p>
        <p className="mt-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          15〜20銘柄あれば、毎週1〜2件は条件を満たします。
          取り込みの手間は増えますが、判断の材料が無いまま待つよりは健全です。
        </p>
        <p className="mt-3 rounded-xl bg-neutral-100 px-3 py-2 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
          退屈だから買う、は最も損をする行動です。条件を満たさない週に何もしないのは、
          手法が働いている証拠であって、失敗ではありません。
        </p>
      </Card>
    </div>
  )
}

function Row({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-neutral-500 dark:text-neutral-400">{label}</dt>
        <dd className="text-base font-semibold tabular-nums">{value}</dd>
      </div>
      <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{note}</p>
    </div>
  )
}
