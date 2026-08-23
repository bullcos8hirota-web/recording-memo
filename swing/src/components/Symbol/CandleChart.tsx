import { useEffect, useMemo, useRef } from 'react'
import type { Series } from '../../lib/market/indicators'
import type { Bar } from '../../lib/market/types'
import { shortDate } from '../../lib/format'
import { useIsPhone } from '../../lib/useMediaQuery'

export type Overlay = { label: string; color: string; values: Series }
export type Level = { label: string; value: number; color: string; dashed?: boolean }

const WIDTH = 760
const PRICE_HEIGHT = 260
const VOLUME_HEIGHT = 64
const GAP = 18
const PADDING_LEFT = 8
const PADDING_RIGHT = 62
const TOTAL_HEIGHT = PRICE_HEIGHT + GAP + VOLUME_HEIGHT + 22

/**
 * ローソク足チャート。外部ライブラリを使わずSVGで描く。
 * overlays に移動平均、levels にエントリー/損切り/利確の水平線を渡す。
 */
export function CandleChart({
  bars,
  overlays = [],
  levels = [],
  visibleBars,
}: {
  bars: Bar[]
  overlays?: Overlay[]
  levels?: Level[]
  visibleBars?: number
}) {
  // スマホで120本詰め込むとローソクが潰れるので、直近だけを大きく見せる。
  const isPhone = useIsPhone()
  const shownBars = visibleBars ?? (isPhone ? 60 : 120)
  const view = useMemo(() => {
    const start = Math.max(0, bars.length - shownBars)
    const slice = bars.slice(start)
    if (slice.length === 0) return null

    let min = Math.min(...slice.map((b) => b.low))
    let max = Math.max(...slice.map((b) => b.high))
    for (const level of levels) {
      if (Number.isFinite(level.value) && level.value > 0) {
        min = Math.min(min, level.value)
        max = Math.max(max, level.value)
      }
    }
    for (const overlay of overlays) {
      for (let i = start; i < bars.length; i += 1) {
        const value = overlay.values[i]
        if (value !== null && value !== undefined) {
          min = Math.min(min, value)
          max = Math.max(max, value)
        }
      }
    }
    const pad = (max - min) * 0.06 || max * 0.02 || 1
    min -= pad
    max += pad

    const plotWidth = WIDTH - PADDING_LEFT - PADDING_RIGHT
    const step = plotWidth / slice.length
    const candleWidth = Math.max(1.5, Math.min(9, step * 0.62))
    const maxVolume = Math.max(...slice.map((b) => b.volume), 1)

    const x = (i: number) => PADDING_LEFT + step * (i + 0.5)
    const y = (value: number) =>
      PRICE_HEIGHT - ((value - min) / (max - min)) * PRICE_HEIGHT
    const volumeY = (value: number) =>
      PRICE_HEIGHT + GAP + VOLUME_HEIGHT - (value / maxVolume) * VOLUME_HEIGHT

    const overlayPaths = overlays.map((overlay) => {
      const points: string[] = []
      for (let i = 0; i < slice.length; i += 1) {
        const value = overlay.values[start + i]
        if (value === null || value === undefined) continue
        points.push(`${points.length === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(value).toFixed(1)}`)
      }
      return { ...overlay, d: points.join(' ') }
    })

    const gridValues = [0, 0.25, 0.5, 0.75, 1].map((r) => min + (max - min) * r)
    const labelStep = Math.max(1, Math.floor(slice.length / 5))
    const dateLabels = slice
      .map((bar, i) => ({ bar, i }))
      .filter(({ i }) => i % labelStep === 0)

    return { slice, start, x, y, volumeY, candleWidth, overlayPaths, gridValues, dateLabels }
  }, [bars, overlays, levels, shownBars])

  // 画面が狭いと横スクロールになるので、いちばん見たい直近の足を先頭に出す。
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = scrollRef.current
    if (element) element.scrollLeft = element.scrollWidth
  }, [bars, shownBars])

  if (!view) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 px-4 py-10 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
        価格データがありません。
      </div>
    )
  }

  const { slice, x, y, volumeY, candleWidth, overlayPaths, gridValues, dateLabels } = view

  return (
    <div className="overflow-x-auto" ref={scrollRef} data-no-swipe>
      <svg
        viewBox={`0 0 ${WIDTH} ${TOTAL_HEIGHT}`}
        className="h-auto w-full sm:min-w-[520px]"
        role="img"
        aria-label="ローソク足チャート"
      >
        {gridValues.map((value) => (
          <g key={`grid-${value}`}>
            <line
              x1={PADDING_LEFT}
              x2={WIDTH - PADDING_RIGHT}
              y1={y(value)}
              y2={y(value)}
              className="stroke-neutral-200 dark:stroke-neutral-800"
              strokeWidth={1}
            />
            <text
              x={WIDTH - PADDING_RIGHT + 6}
              y={y(value) + 4}
              className="fill-neutral-400 text-[11px] tabular-nums dark:fill-neutral-500"
            >
              {Math.round(value).toLocaleString('ja-JP')}
            </text>
          </g>
        ))}

        {slice.map((bar, i) => {
          const up = bar.close >= bar.open
          const color = up ? 'fill-rose-500 stroke-rose-500' : 'fill-sky-500 stroke-sky-500'
          const bodyTop = y(Math.max(bar.open, bar.close))
          const bodyBottom = y(Math.min(bar.open, bar.close))
          return (
            <g key={bar.date} className={color}>
              <line
                x1={x(i)}
                x2={x(i)}
                y1={y(bar.high)}
                y2={y(bar.low)}
                strokeWidth={1}
              />
              <rect
                x={x(i) - candleWidth / 2}
                y={bodyTop}
                width={candleWidth}
                height={Math.max(1, bodyBottom - bodyTop)}
              />
              <rect
                x={x(i) - candleWidth / 2}
                y={volumeY(bar.volume)}
                width={candleWidth}
                height={Math.max(1, PRICE_HEIGHT + GAP + VOLUME_HEIGHT - volumeY(bar.volume))}
                opacity={0.45}
              />
            </g>
          )
        })}

        {overlayPaths.map((overlay) => (
          <path
            key={overlay.label}
            d={overlay.d}
            fill="none"
            stroke={overlay.color}
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
        ))}

        {levels
          .filter((level) => Number.isFinite(level.value) && level.value > 0)
          .map((level) => (
            <g key={level.label}>
              <line
                x1={PADDING_LEFT}
                x2={WIDTH - PADDING_RIGHT}
                y1={y(level.value)}
                y2={y(level.value)}
                stroke={level.color}
                strokeWidth={1.2}
                strokeDasharray={level.dashed === false ? undefined : '5 4'}
              />
              <text
                x={PADDING_LEFT + 4}
                y={y(level.value) - 4}
                className="text-[11px]"
                fill={level.color}
              >
                {level.label}
              </text>
            </g>
          ))}

        {dateLabels.map(({ bar, i }) => (
          <text
            key={`date-${bar.date}`}
            x={x(i)}
            y={TOTAL_HEIGHT - 4}
            textAnchor="middle"
            className="fill-neutral-400 text-[11px] dark:fill-neutral-500"
          >
            {shortDate(bar.date)}
          </text>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-neutral-500 dark:text-neutral-400">
        {overlayPaths.map((overlay) => (
          <span key={`legend-${overlay.label}`} className="inline-flex items-center gap-1">
            <span
              className="inline-block h-0.5 w-4 rounded"
              style={{ backgroundColor: overlay.color }}
            />
            {overlay.label}
          </span>
        ))}
        <span>下段は出来高</span>
      </div>
    </div>
  )
}
