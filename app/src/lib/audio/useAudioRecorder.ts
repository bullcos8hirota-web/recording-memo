import { useEffect, useMemo, useState } from 'react'
import { AudioRecorder, type RecorderState } from './recorder'

export function useAudioRecorder() {
  const recorder = useMemo(() => new AudioRecorder(), [])
  const [state, setState] = useState<RecorderState>({
    status: 'idle',
    elapsedMs: 0,
    error: null,
  })

  useEffect(() => recorder.subscribe(setState), [recorder])

  return { recorder, state }
}
