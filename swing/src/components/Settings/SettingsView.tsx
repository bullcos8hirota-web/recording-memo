import { useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { db, DEFAULT_CHECKLIST } from '../../lib/db'
import { STANDARD_PLAN_TIERS } from '../../lib/money/fees'
import { yen } from '../../lib/format'
import { buttonClass, Card, Field, inputClass, subtleButtonClass } from '../ui/Primitives'
import { usePwaInstall } from '../../lib/usePwaInstall'

export function SettingsView() {
  const settings = useAppStore((s) => s.settings)
  const saveSettings = useAppStore((s) => s.saveSettings)
  const load = useAppStore((s) => s.load)
  const [checklistText, setChecklistText] = useState(settings.checklist.join('\n'))

  const riskAmount = Math.floor((settings.capital * settings.riskPercent) / 100)

  return (
    <div className="space-y-4">
      <InstallCard />

      <Card
        title="資金管理"
        description="ここで決めた許容損失から、売買プランの株数が自動で決まります。"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="運用資金(円)" hint={`1トレードの許容損失は ${yen(riskAmount)}`}>
            <input
              className={inputClass}
              value={settings.capital}
              onChange={(e) => void saveSettings({ capital: Number(e.target.value) || 0 })}
              inputMode="numeric"
            />
          </Field>
          <Field label="1トレードの許容損失(%)" hint="1〜2%が一般的。大きくすると連敗時の傷が深くなります。">
            <input
              className={inputClass}
              value={settings.riskPercent}
              onChange={(e) => void saveSettings({ riskPercent: Number(e.target.value) || 0 })}
              inputMode="decimal"
            />
          </Field>
          <Field label="1銘柄への投入上限(%)" hint="資金が偏りすぎないための上限です。">
            <input
              className={inputClass}
              value={settings.maxPositionPercent}
              onChange={(e) => void saveSettings({ maxPositionPercent: Number(e.target.value) || 0 })}
              inputMode="decimal"
            />
          </Field>
          <Field label="利確倍率(リスクの何倍)" hint="2なら、損切り幅の2倍の値幅を利確目標にします。">
            <input
              className={inputClass}
              value={settings.rewardRatio}
              onChange={(e) => void saveSettings({ rewardRatio: Number(e.target.value) || 0 })}
              inputMode="decimal"
            />
          </Field>
          <Field label="損切り幅(ATRの何倍)" hint="値動きの荒い銘柄ほど損切りが自動で広がります。">
            <input
              className={inputClass}
              value={settings.atrMultiple}
              onChange={(e) => void saveSettings({ atrMultiple: Number(e.target.value) || 0 })}
              inputMode="decimal"
            />
          </Field>
          <Field label="既定の売買単位" hint="単元株は100株、S株(単元未満株)なら1。">
            <input
              className={inputClass}
              value={settings.defaultLot}
              onChange={(e) => void saveSettings({ defaultLot: Number(e.target.value) || 1 })}
              inputMode="numeric"
            />
          </Field>
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
                <input
                  className={`${inputClass} w-28`}
                  value={tier.fee}
                  onChange={(e) => {
                    const tiers = settings.feeConfig.tiers.map((row, i) =>
                      i === index ? { ...row, fee: Number(e.target.value) || 0 } : row,
                    )
                    void saveSettings({ feeConfig: { ...settings.feeConfig, tiers } })
                  }}
                  inputMode="numeric"
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

      <Card title="エントリー前チェックリスト" description="1行に1項目。売買プラン画面に表示されます。">
        <textarea
          className={`${inputClass} min-h-40`}
          value={checklistText}
          onChange={(e) => setChecklistText(e.target.value)}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className={buttonClass}
            onClick={() =>
              void saveSettings({
                checklist: checklistText
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean),
              })
            }
          >
            保存
          </button>
          <button
            type="button"
            className={subtleButtonClass}
            onClick={() => {
              setChecklistText(DEFAULT_CHECKLIST.join('\n'))
              void saveSettings({ checklist: DEFAULT_CHECKLIST })
            }}
          >
            初期値に戻す
          </button>
        </div>
      </Card>

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
