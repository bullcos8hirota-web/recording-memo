import { useState } from 'react'
import { QUESTIONS, type Question } from '../../lib/learn/quiz'
import { buttonClass, Card, subtleButtonClass } from '../ui/Primitives'
import { TermChip } from './HelpButton'

const QUIZ_LENGTH = 5

/** 出題順をランダムに入れ替える(Fisher-Yates)。 */
function pickQuestions(count: number): Question[] {
  const pool = [...QUESTIONS]
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count)
}

export function QuizSection() {
  const [questions, setQuestions] = useState(() => pickQuestions(QUIZ_LENGTH))
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [correct, setCorrect] = useState(0)
  const [done, setDone] = useState(false)

  const question = questions[index]
  const answered = selected !== null

  const restart = () => {
    setQuestions(pickQuestions(QUIZ_LENGTH))
    setIndex(0)
    setSelected(null)
    setCorrect(0)
    setDone(false)
  }

  const choose = (choice: number) => {
    if (answered) return
    setSelected(choice)
    if (choice === question.answer) setCorrect((value) => value + 1)
  }

  const next = () => {
    if (index + 1 >= questions.length) {
      setDone(true)
      return
    }
    setIndex(index + 1)
    setSelected(null)
  }

  if (done) {
    const rate = (correct / questions.length) * 100
    return (
      <Card title="結果">
        <div className="rounded-2xl bg-neutral-50 p-4 text-center dark:bg-neutral-800/60">
          <div className="text-3xl font-semibold tabular-nums">
            {correct} / {questions.length}
          </div>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
            {rate === 100
              ? '全問正解です。用語は身についています。'
              : rate >= 60
                ? 'だいたい掴めています。間違えたところは用語集で読み直してみてください。'
                : '解説を読むところからで大丈夫です。用語集を1周してから、もう一度どうぞ。'}
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={buttonClass} onClick={restart}>
            もう一度(別の問題)
          </button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card
        title="理解度チェック"
        description={`全${QUESTIONS.length}問からランダムに${QUIZ_LENGTH}問出します。正解しなくても、解説を読めば十分です。`}
      >
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
            <div
              className="h-full rounded-full bg-neutral-900 transition-all dark:bg-neutral-100"
              style={{ width: `${((index + (answered ? 1 : 0)) / questions.length) * 100}%` }}
            />
          </div>
          <span className="shrink-0 text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
            {index + 1} / {questions.length}
          </span>
        </div>
      </Card>

      <Card>
        <h3 className="text-base font-semibold leading-relaxed">{question.question}</h3>
        <ul className="mt-3 space-y-2">
          {question.choices.map((choice, choiceIndex) => {
            const isAnswer = choiceIndex === question.answer
            const isSelected = selected === choiceIndex
            const style = !answered
              ? 'border-neutral-300 dark:border-neutral-700'
              : isAnswer
                ? 'border-rose-400 bg-rose-50 dark:border-rose-700 dark:bg-rose-950/40'
                : isSelected
                  ? 'border-sky-400 bg-sky-50 dark:border-sky-700 dark:bg-sky-950/40'
                  : 'border-neutral-200 opacity-60 dark:border-neutral-800'
            return (
              <li key={choice}>
                <button
                  type="button"
                  onClick={() => choose(choiceIndex)}
                  disabled={answered}
                  className={`flex w-full items-start gap-2 rounded-xl border px-3 py-3 text-left text-sm transition ${style}`}
                >
                  <span className="mt-0.5 shrink-0 text-xs text-neutral-400">
                    {'ABCD'[choiceIndex]}
                  </span>
                  <span className="flex-1">{choice}</span>
                  {answered && isAnswer && <span className="text-rose-600 dark:text-rose-400">正解</span>}
                  {answered && isSelected && !isAnswer && (
                    <span className="text-sky-600 dark:text-sky-400">選択</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>

        {answered && (
          <div className="mt-3 rounded-xl bg-neutral-50 px-3 py-3 dark:bg-neutral-800/60">
            <p className="text-sm font-medium">
              {selected === question.answer ? '正解です' : '惜しい'}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
              {question.explanation}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <TermChip id={question.term} />
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={buttonClass} disabled={!answered} onClick={next}>
            {index + 1 >= questions.length ? '結果を見る' : '次の問題'}
          </button>
          <button type="button" className={subtleButtonClass} onClick={restart}>
            やり直す
          </button>
        </div>
      </Card>
    </div>
  )
}
