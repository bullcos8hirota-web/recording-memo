import { Recorder } from './components/Recorder/Recorder'
import { HistoryList } from './components/HistoryList/HistoryList'

function App() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
      <header className="border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
        <h1 className="text-lg font-semibold">録音・自動要約アプリ</h1>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Recorder />
        <HistoryList />
      </main>
    </div>
  )
}

export default App
