import { analyze, VERDICT_LABEL } from '../market/signals'
import { earningsAlert } from '../market/earnings'
import { evaluateTrade, isClosed, type Trade } from '../money/trade'
import type { Bar, Stock } from '../market/types'
import type { Settings } from '../db/schema'
import { BUILD_ID } from '../version'

const money = (value: number): string => `${Math.round(value).toLocaleString('ja-JP')}円`

const round = (value: number | null | undefined, digits = 1): string =>
  value === null || value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(digits)

const signed = (value: number | null | undefined, digits = 1): string =>
  value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`

const short = (date: string): string => {
  const [, month, day] = date.split('-')
  return `${Number(month)}/${Number(day)}`
}

/**
 * 監視リストの状態を、そのまま人に渡せる文章にする。
 * データは端末の中にしかないので、誰かに相談したいときはこれをコピーして貼ってもらう。
 */
export function buildWatchlistText(input: {
  stocks: Stock[]
  series: Record<string, Bar[]>
  trades: Trade[]
  settings: Settings
  now?: Date
}): string {
  const { stocks, series, trades, settings } = input
  const now = input.now ?? new Date()
  const stamp =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-` +
    `${String(now.getDate()).padStart(2, '0')} ` +
    `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const lines: string[] = [
    `スイングトレード支援 / ${stamp} 時点 / 画面の版 ${BUILD_ID}`,
    `資金 ${money(settings.capital)} / 1トレードの許容損失 ${money(
      (settings.capital * settings.riskPercent) / 100,
    )}(${settings.riskPercent}%) / 1銘柄上限 ${settings.maxPositionPercent}%`,
  ]

  const holding = new Set(trades.filter((trade) => !isClosed(trade)).map((trade) => trade.code))

  const rows = stocks
    .map((stock) => {
      const bars = series[stock.code] ?? []
      return { stock, bars, analysis: bars.length >= 30 ? analyze(bars) : null }
    })
    .sort((a, b) => (b.analysis?.score ?? -1) - (a.analysis?.score ?? -1))

  lines.push('', `【監視 ${rows.length}銘柄】`)
  if (rows.length === 0) lines.push('(登録なし)')

  for (const { stock, bars, analysis } of rows) {
    lines.push(`${stock.code} ${stock.name}${holding.has(stock.code) ? ' [建玉あり]' : ''}`)

    if (bars.length === 0) {
      lines.push('  価格データなし')
      continue
    }
    const lastDate = short(bars[bars.length - 1].date)
    if (!analysis) {
      lines.push(`  データ不足(${bars.length}本 / ${lastDate}まで)`)
      continue
    }

    const snapshot = analysis.snapshot
    lines.push(
      `  スコア${analysis.score} ${VERDICT_LABEL[analysis.verdict]}` +
        ` | 終値${money(snapshot.close)}(${signed(snapshot.changeRate)})` +
        ` 高値${money(snapshot.high)} 安値${money(snapshot.low)}` +
        ` | ${bars.length}本 ${lastDate}まで`,
    )
    lines.push(
      `  25日線${round(snapshot.sma25, 0)} 乖離${signed(snapshot.deviation25)}` +
        ` / 75日線${round(snapshot.sma75, 0)}` +
        ` / RSI ${round(snapshot.rsi14)}` +
        ` / ATR ${round(snapshot.atr14, 0)}円` +
        ` / 出来高 20日平均の${
          snapshot.volumeRatio === null ? '—' : Math.round(snapshot.volumeRatio * 100)
        }%`,
    )

    // 出来高が入っていないと判断材料がひとつ欠ける。何本欠けているかまで書いておく。
    const withoutVolume = bars.filter((bar) => bar.volume <= 0).length
    if (withoutVolume > 0) {
      lines.push(`  ※出来高が未取込 ${withoutVolume}/${bars.length}本(直近 ${bars[bars.length - 1].volume})`)
    }

    const good = analysis.signals.filter((signal) => signal.tone === 'bull')
    const bad = analysis.signals.filter((signal) => signal.tone !== 'bull')
    if (good.length > 0) lines.push(`  ○ ${good.map((signal) => signal.label).join(', ')}`)
    if (bad.length > 0) lines.push(`  × ${bad.map((signal) => signal.label).join(', ')}`)

    const earnings = earningsAlert(stock.earningsDate, now)
    if (earnings && !earnings.past) {
      lines.push(`  決算発表 ${short(stock.earningsDate!)}(あと${earnings.days}日)`)
    }
    const exRights = earningsAlert(stock.exRightsDate, now)
    if (exRights && !exRights.past) {
      lines.push(`  権利確定 ${short(stock.exRightsDate!)}(あと${exRights.days}日)`)
    }
    if (stock.memo) lines.push(`  メモ: ${stock.memo}`)
  }

  const open = trades.filter((trade) => !isClosed(trade))
  if (open.length > 0) {
    lines.push('', `【建玉 ${open.length}件】`)
    for (const trade of open) {
      const last = series[trade.code]?.at(-1)?.close ?? null
      const result = evaluateTrade(trade, last)
      lines.push(
        `${trade.code} ${trade.name} ${short(trade.entryDate)}買` +
          ` ${money(trade.entryPrice)}×${trade.shares}株` +
          ` | 現在${last === null ? '—' : money(last)}` +
          ` ${result.profit >= 0 ? '+' : ''}${money(result.profit)}(${signed(result.profitPercent)})` +
          ` | 損切${trade.stopPrice === null ? '未設定' : money(trade.stopPrice)}` +
          ` 利確${trade.targetPrice === null ? '未設定' : money(trade.targetPrice)}`,
      )
    }
  }

  const closed = trades.filter(isClosed)
  if (closed.length > 0) {
    const total = closed.reduce((sum, trade) => sum + evaluateTrade(trade).profit, 0)
    const wins = closed.filter((trade) => evaluateTrade(trade).profit >= 0).length
    lines.push(
      '',
      `【成績】${closed.length}回 / 勝ち${wins} / 損益合計 ${total >= 0 ? '+' : ''}${money(total)}`,
    )
  }

  return lines.join('\n')
}
