import { useAppStore } from '../../stores/appStore'
import { db } from '../../lib/db'
import { STANDARD_PLAN_TIERS } from '../../lib/money/fees'
import { yen } from '../../lib/format'
import { buttonClass, Card, NumberField, subtleButtonClass } from '../ui/Primitives'
import { usePwaInstall } from '../../lib/usePwaInstall'
import { ReminderCard } from './ReminderCard'
import { HistoryImportCard, SampleDataCard } from './DataCards'
import { BUILD_ID } from '../../lib/version'

export function SettingsView() {
  const settings = useAppStore((s) => s.settings)
  const saveSettings = useAppStore((s) => s.saveSettings)
  const load = useAppStore((s) => s.load)

  const riskAmount = Math.floor((settings.capital * settings.riskPercent) / 100)

  return (
    <div className="space-y-4">
      <InstallCard />

      <ReminderCard />

      <Card
        title="資金管理"
        description="入力するとすぐ保存されます(保存ボタンはありません)。ここで決めた許容損失から、売買プランの株数が自動で決まります。"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            label="運用資金(円)"
            hint={`1トレードの許容損失は ${yen(riskAmount)}`}
            value={settings.capital}
            inputMode="numeric"
            onCommit={(value) => void saveSettings({ capital: value || 0 })}
          />
          <NumberField
            label="1トレードの許容損失(%)"
            help="risk-per-trade"
            hint="1〜2%が一般的。大きくすると連敗時の傷が深くなります。"
            value={settings.riskPercent}
            inputMode="decimal"
            onCommit={(value) => void saveSettings({ riskPercent: value || 0 })}
          />
          <NumberField
            label="1銘柄への投入上限(%)"
            help="position-sizing"
            hint="資金が偏りすぎないための上限です。"
            value={settings.maxPositionPercent}
            inputMode="decimal"
            onCommit={(value) => void saveSettings({ maxPositionPercent: value || 0 })}
          />
          <NumberField
            label="利確倍率(リスクの何倍)"
            help="risk-reward"
            hint="2なら、損切り幅の2倍の値幅を利確目標にします。"
            value={settings.rewardRatio}
            inputMode="decimal"
            onCommit={(value) => void saveSettings({ rewardRatio: value || 0 })}
          />
          <div className="col-span-full">
            <p className="text-sm font-medium">出口の決め方</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  ['trailing', 'トレーリング', '利確を置かず、損切りを毎週上げていく。上限を作らない代わりに、天井からATR分は返す。'],
                  ['target', '利確目標を置く', '上の利確倍率で決めた価格に届いたら売る。取れる額は決まるが、いつ終わるかが読める。'],
                ] as const
              ).map(([value, label, hint]) => (
                <button
                  key={value}
                  type="button"
                  className={settings.exitStyle === value ? buttonClass : subtleButtonClass}
                  onClick={() => void saveSettings({ exitStyle: value })}
                  title={hint}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              {settings.exitStyle === 'trailing'
                ? '建玉を記録するとき、利確目標は入れません。毎週末、建玉タブのトレーリング目安まで損切りを上げていきます。'
                : '建玉を記録するとき、利確倍率から計算した価格を利確目標として入れます。'}
            </p>
          </div>
          <NumberField
            label="損切り幅(ATRの何倍)"
            help="atr"
            hint="値動きの荒い銘柄ほど損切りが自動で広がります。"
            value={settings.atrMultiple}
            inputMode="decimal"
            onCommit={(value) => void saveSettings({ atrMultiple: value || 0 })}
          />
          <NumberField
            label="既定の売買単位"
            help="unit-share"
            hint="単元株は100株、S株(単元未満株)なら1。"
            value={settings.defaultLot}
            inputMode="numeric"
            onCommit={(value) => void saveSettings({ defaultLot: value || 1 })}
          />
        </div>
      </Card>

      <Card
        title="手数料"
        description="SBI証券の国内株式手数料はゼロ革命の条件を満たすと0円になります。プランを使っている場合は段階手数料に切り替えて、最新の金額に直してください。"
      >
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={settings.feeConfig.mode === 'free' ? buttonClass : subtleButtonClass}
            onClick={() => void saveSettings({ feeConfig: { ...settings.feeConfig, mode: 'free' } })}
          >
            0円(ゼロ革命)
          </button>
          <button
            type="button"
            className={settings.feeConfig.mode === 'tiered' ? buttonClass : subtleButtonClass}
            onClick={() => void saveSettings({ feeConfig: { ...settings.feeConfig, mode: 'tiered' } })}
          >
            段階手数料
          </button>
          <button
            type="button"
            className={subtleButtonClass}
            onClick={() =>
              void saveSettings({ feeConfig: { mode: 'tiered', tiers: STANDARD_PLAN_TIERS } })
            }
          >
            参考値を読み込む
          </button>
        </div>

        {settings.feeConfig.mode === 'tiered' && (
          <ul className="mt-3 space-y-2">
            {settings.feeConfig.tiers.map((tier, index) => (
              <li key={`${tier.upTo}-${index}`} className="flex items-center gap-2 text-sm">
                <span className="w-40 text-neutral-500 dark:text-neutral-400">
                  {Number.isFinite(tier.upTo) ? `${tier.upTo.toLocaleString('ja-JP')}円まで` : 'それ以上'}
                </span>
                <NumberField
                  label=""
                  className="w-28"
                  value={tier.fee}
                  inputMode="numeric"
                  onCommit={(value) => {
                    const tiers = settings.feeConfig.tiers.map((row, i) =>
                      i === index ? { ...row, fee: value || 0 } : row,
                    )
                    void saveSettings({ feeConfig: { ...settings.feeConfig, tiers } })
                  }}
                />
                <span className="text-neutral-500 dark:text-neutral-400">円(税込)</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
          表示している金額は目安です。実際の手数料はSBI証券の最新の料金体系を確認してください。
        </p>
      </Card>

      <HistoryImportCard />

      <SampleDataCard />

      <Card title="データ" description="すべてこの端末のブラウザ内(IndexedDB)に保存されます。サーバーには送信しません。">
        <button
          type="button"
          className={subtleButtonClass}
          onClick={async () => {
            if (!confirm('銘柄・価格データ・トレード記録をすべて削除しますか?')) return
            await db.delete()
            await db.open()
            await load()
          }}
        >
          すべてのデータを削除
        </button>
      </Card>

      <Card title="このアプリについて">
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          チャートの状態を点数化したり、許容損失から株数を計算したりして、スイングトレードの判断材料を整理するためのツールです。
          将来の値動きを予測するものではなく、特定の銘柄の売買を推奨するものでもありません。投資判断はご自身の責任で行ってください。
          SBI証券とは無関係の個人ツールで、発注機能はありません。
        </p>
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          画面の版 {BUILD_ID}
          （うまく動かないときは、この版が最新か確認してから、ブラウザを一度閉じて開き直してください）
        </p>
      </Card>
    </div>
  )
}

/** スマホのホーム画面に追加してもらうための案内。 */
function InstallCard() {
  const { installed, canInstall, isIos, install } = usePwaInstall()

  if (installed) {
    return (
      <Card title="アプリとして起動中">
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          ホーム画面から起動しています。オフラインでも開けます。
        </p>
      </Card>
    )
  }

  return (
    <Card
      title="スマホのホーム画面に追加"
      description="追加すると、ブラウザのバーが消えてアプリのように使えます。電波が無くても開けます。"
    >
      {canInstall ? (
        <button type="button" className={buttonClass} onClick={() => void install()}>
          ホーム画面に追加
        </button>
      ) : isIos ? (
        <ol className="list-decimal space-y-1 pl-5 text-sm text-neutral-600 dark:text-neutral-300">
          <li>Safariの下にある共有ボタン(□に↑)を押す</li>
          <li>メニューを下にスクロールして「ホーム画面に追加」を選ぶ</li>
          <li>右上の「追加」を押す</li>
        </ol>
      ) : (
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          ブラウザのメニューから「ホーム画面に追加」または「アプリをインストール」を選んでください。
        </p>
      )}
    </Card>
  )
}
