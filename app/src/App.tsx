import { AiSettings } from './components/AiSettings/AiSettings'
import { DriveSettings } from './components/DriveSettings/DriveSettings'
import { HistoryList } from './components/HistoryList/HistoryList'
import { Recorder } from './components/Recorder/Recorder'

function App() {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-lg font-semibold">録音メモ</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            録音して、AIメモとして保存します。
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-4 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-8">
        <AiSettings />
        <DriveSettings />
        <Recorder />
        <HistoryList />
      </main>
    </div>
  )
}

export default App
