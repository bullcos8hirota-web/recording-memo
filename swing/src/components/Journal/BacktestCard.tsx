import { useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { backtest, type BacktestResult } from '../../lib/backtest/simulate'
import { percent, price, shortDate, toneClass, yen } from '../../lib/format'
import { buttonClass, Card, Disclosure, Stat } from '../ui/Primitives'

/**
 * 過去に同じルールを流したらどうだったか。
 *
 * 数回の実績では、手法が悪いのか相場が悪かったのかが分からない。やめる・続けるを
 * 気分で決めないために、同じルールを過去の値動きに通した数字を出す。
 */
export function BacktestCard() {
  const stocks = useAppStore((s) => s.stocks)
  const series = useAppStore((s) => s.series)
  const settings = useAppStore((s) => s.settings)

  const [result, setResult] = useState<BacktestResult | null>(null)
  const [state, setState] = useState<'idle' | 'running' | 'short'>('idle')

  const run = () => {
    setState('running')
    // 重い計算なので、ボタンの見た目が変わってから始める。
    setTimeout(() => {
      const outcome = backtest({ stocks, series, settings })
      setResult(outcome)
      setState(outcome ? 'idle' : 'short')
    }, 30)
  }

  const beat = result ? result.returnPercent - result.benchmark.returnPercent : 0

  return (
    <Card
      title="過去に試す"
      description="いま登録してある銘柄の日足に、今のルールをそのまま流します。"
    >
      <button
        type="button"
        className={`${buttonClass} w-full`}
        onClick={run}
        disabled={state === 'running'}
      >
        {state === 'running' ? '計算中…' : result ? 'もう一度計算する' : '計算する'}
      </button>

      {state === 'short' && (
        <p className="mt-3 rounded-xl bg-amber-100 px-3 py-3 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          日足が足りません。判定に80本、そのうえで売り買いする余地が要ります。
          「全銘柄を更新」で株価を取り込んでから、もう一度試してください。
        </p>
      )}

      {result && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300 tabular-nums">
            {shortDate(result.from)} 〜 {shortDate(result.to)}／週の判断 {result.decisions}回
            ／売買 {result.trades.length}回
          </p>

          {result.trades.length === 0 ? (
            <p className="rounded-xl bg-slate-100 px-3 py-3 text-sm dark:bg-slate-700/40">
              この期間、ルールは一度も買いませんでした。条件が厳しすぎるか、
              地合いがずっと悪かったかのどちらかです。
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat
                  label="損益合計"
                  value={yen(result.totalProfit)}
                  tone={toneClass(result.totalProfit)}
                  hint={`資金の${percent(result.returnPercent)}`}
                />
                <Stat
                  label="勝率"
                  value={`${result.winRate.toFixed(0)}%`}
                  hint={`勝ち${result.wins} / 負け${result.losses}`}
                />
                <Stat
                  label="平均利益 ÷ 平均損失"
                  value={result.payoff ? result.payoff.toFixed(2) : '—'}
                  hint="1を超えていれば勝ちのほうが大きい"
                />
                <Stat
                  label="1回あたり"
                  value={yen(result.expectancy)}
                  tone={toneClass(result.expectancy)}
                  hint="期待値"
                />
                <Stat label="平均利益" value={yen(result.averageWin)} />
                <Stat label="平均損失" value={yen(-result.averageLoss)} />
                <Stat
                  label="最大連敗"
                  value={`${result.maxConsecutiveLosses}回`}
                  hint="これが続いても耐えられるか"
                />
                <Stat
                  label="最大の落ち込み"
                  value={percent(-result.maxDrawdownPercent)}
                  hint={yen(-result.maxDrawdown)}
                />
              </div>

              {/* 比べる相手がいないと、良い悪いが決まらない */}
              <div className="rounded-xl bg-slate-100 px-3 py-3 text-sm dark:bg-slate-700/40">
                <p className="font-medium">選ばずに、全部買って持っていたら</p>
                <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-y-1 tabular-nums">
                  <dt className="text-slate-600 dark:text-slate-300">ルール通り</dt>
                  <dd className={toneClass(result.totalProfit)}>
                    {percent(result.returnPercent)}（最大の落ち込み{' '}
                    {percent(-result.maxDrawdownPercent)}）
                  </dd>
                  <dt className="text-slate-600 dark:text-slate-300">
                    買い持ち{result.benchmark.stocks}銘柄
                  </dt>
                  <dd className={toneClass(result.benchmark.profit)}>
                    {percent(result.benchmark.returnPercent)}（最大の落ち込み{' '}
                    {percent(-result.benchmark.maxDrawdownPercent)}）
                  </dd>
                </dl>
                <p className="mt-2 border-t border-slate-300 pt-2 dark:border-slate-600">
                  {beat >= 0
                    ? `売り買いした分だけ ${percent(beat)} 勝っています。`
                    : `売り買いせず持っていたほうが ${percent(-beat)} 良かった、ということです。`}
                </p>
              </div>

              <Disclosure summary={`売買の中身 ${result.trades.length}件`}>
                <ul className="space-y-2 text-sm tabular-nums">
                  {result.trades.map((trade, i) => (
                    <li
                      key={`${trade.code}-${trade.entryDate}-${i}`}
                      className="flex items-baseline justify-between gap-2 border-b border-slate-200 pb-2 last:border-0 dark:border-slate-700"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{trade.name}</span>
                        <span className="block text-xs text-slate-600 dark:text-slate-300">
                          {shortDate(trade.entryDate)} {price(trade.entryPrice)} →{' '}
                          {shortDate(trade.exitDate)} {price(trade.exitPrice)}
                          {trade.reason === 'trail' && '（上げた損切り）'}
                          {trade.reason === 'end' && '（期間の終わり）'}
                        </span>
                      </span>
                      <span className={`shrink-0 font-medium ${toneClass(trade.profit)}`}>
                        {yen(trade.profit)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Disclosure>
            </>
          )}

          <Disclosure summary="この数字を信じすぎないために">
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <li>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  決算と権利落ちを見ていません。
                </span>
                次回の1件しか持っていないので、過去のある日にそれが近かったかを再現
                できません。実際はこの条件でさらに何件か見送るため、ここの結果は少しだけ
                甘い側に出ます。
              </li>
              <li>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  今の銘柄で過去を見ています。
                </span>
                「今おすすめに残っている銘柄」を過去に流すと、生き残ったものばかりを
                見ることになります。実際より良く出る方向の歪みです。
              </li>
              <li>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  期間が短い。
                </span>
                1年に満たない日足では、上げ相場か下げ相場かのどちらか一方しか見ていない
                可能性が高いです。{result.trades.length}回の売買も、まだ結論を出せる数では
                ありません。
              </li>
              <li>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  比較はオルカンではありません。
                </span>
                手元にあるのは日本株の日足だけなので、比べられるのは「同じ銘柄を選ばずに
                持っていたら」までです。
              </li>
              <li>
                注文の出し忘れや期限切れといった、実際に起きた取りこぼしは入っていません。
              </li>
            </ul>
          </Disclosure>
        </div>
      )}
    </Card>
  )
}
