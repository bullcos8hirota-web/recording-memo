import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { message: string | null; stack: string | null }

/**
 * 画面が真っ黒になるのを防ぐ。Reactは描画中に例外が出ると全部を外すので、
 * 受け止めて、何が起きたかと復帰の手段を出す。
 * 原因を知らせてもらえないと直せないので、本文をコピーできるようにしている。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { message: null, stack: null }

  static getDerivedStateFromError(error: unknown): State {
    return {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? (error.stack ?? null) : null,
    }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('画面の描画に失敗しました', error, info)
  }

  render() {
    if (this.state.message === null) return this.props.children

    const report = [
      '画面の描画に失敗しました',
      this.state.message,
      this.state.stack?.split('\n').slice(0, 6).join('\n') ?? '',
    ].join('\n')

    return (
      <div className="min-h-[100dvh] bg-slate-50 p-4 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <h1 className="text-base font-semibold">画面を出せませんでした</h1>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
            保存したデータは残っています。下のボタンで開き直してください。
            それでも同じところで止まる場合は、この文章をコピーして知らせてください。
          </p>
          <pre className="mt-3 max-h-48 overflow-auto rounded-xl bg-slate-100 p-3 text-xs dark:bg-slate-700">
            {report}
          </pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900"
              onClick={() => window.location.reload()}
            >
              開き直す
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 text-sm font-medium dark:border-slate-600"
              onClick={() => void navigator.clipboard?.writeText(report)}
            >
              内容をコピー
            </button>
          </div>
        </div>
      </div>
    )
  }
}
