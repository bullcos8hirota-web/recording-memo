import { grahamVerdict, type evaluateFundamentals } from '../../lib/learn/buffett'
import { HelpButton } from './HelpButton'
import { VERDICT_STYLE } from './verdictStyle'

type Result = ReturnType<typeof evaluateFundamentals>

/** 判定結果の見出し(点数・益回り・要約)。 */
export function FundamentalsSummary({ result }: { result: Result }) {
  return (
    <div className="rounded-2xl bg-neutral-50 p-3 dark:bg-neutral-800/60">
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
          PER × PBR = {result.grahamNumber.toFixed(1)}（グレアムの目安は22.5以下 →{' '}
          {VERDICT_STYLE[grahamVerdict(result.grahamNumber)].label}）
        </p>
      )}
    </div>
  )
}

/** 項目ごとの判定。目安と「なぜ見るのか」も一緒に出す。 */
export function FundamentalsChecks({ result }: { result: Result }) {
  return (
    <ul className="space-y-2">
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
            <span className="text-sm tabular-nums">{check.display}</span>
          </div>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">目安: {check.target}</p>
          <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{check.why}</p>
          {check.verdict !== 'unknown' && (
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">→ {check.comment}</p>
          )}
        </li>
      ))}
    </ul>
  )
}
