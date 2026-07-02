interface ModelLoadingIndicatorProps {
  progress: number
  label: string
}

export function ModelLoadingIndicator({ progress, label }: ModelLoadingIndicatorProps) {
  const clamped = Math.min(100, Math.max(0, progress))
  return (
    <div className="mt-2">
      <div className="h-2 w-full overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800">
        <div
          className="h-full bg-blue-600 transition-all"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        {label}を準備中... {Math.round(clamped)}%
        （初回のみ数百MBのダウンロードが発生します。2回目以降はキャッシュから高速に読み込まれます）
      </p>
    </div>
  )
}
