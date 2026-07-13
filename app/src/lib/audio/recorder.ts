export type RecorderStatus = 'idle' | 'recording' | 'paused' | 'stopped' | 'error'

export interface RecorderState {
  status: RecorderStatus
  elapsedMs: number
  error: string | null
}

type Listener = (state: RecorderState) => void

const PREFERRED_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type))
}

/** Wraps MediaRecorder + AnalyserNode so the UI can show live waveform data. */
export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private analyserNode: AnalyserNode | null = null
  private chunks: BlobPart[] = []
  private startedAt = 0
  private pausedAccumMs = 0
  private pausedAt = 0
  private timerId: number | null = null
  private listeners = new Set<Listener>()
  private state: RecorderState = { status: 'idle', elapsedMs: 0, error: null }

  get analyser(): AnalyserNode | null {
    return this.analyserNode
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  private setState(partial: Partial<RecorderState>) {
    this.state = { ...this.state, ...partial }
    this.listeners.forEach((listener) => listener(this.state))
  }

  async start(): Promise<boolean> {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      this.setState({
        status: 'error',
        error:
          'マイクへのアクセスが許可されませんでした。ブラウザの権限設定を確認してください。',
      })
      return false
    }
    this.stream = stream

    try {
      this.audioContext = new AudioContext()
      const source = this.audioContext.createMediaStreamSource(stream)
      this.analyserNode = this.audioContext.createAnalyser()
      this.analyserNode.fftSize = 2048
      source.connect(this.analyserNode)

      const mimeType = pickMimeType()
      this.mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      this.chunks = []
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.chunks.push(event.data)
      }
      this.mediaRecorder.start()
    } catch {
      this.cleanup()
      this.setState({
        status: 'error',
        error: 'このブラウザでは録音を開始できませんでした。ChromeまたはSafariの最新版でお試しください。',
      })
      return false
    }
    this.startedAt = performance.now()
    this.pausedAccumMs = 0
    this.setState({ status: 'recording', elapsedMs: 0, error: null })
    this.startTimer()
    return true
  }

  pause(): void {
    if (this.mediaRecorder?.state !== 'recording') return
    this.mediaRecorder.pause()
    this.pausedAt = performance.now()
    this.stopTimer()
    this.setState({ status: 'paused' })
  }

  resume(): void {
    if (this.mediaRecorder?.state !== 'paused') return
    this.mediaRecorder.resume()
    this.pausedAccumMs += performance.now() - this.pausedAt
    this.setState({ status: 'recording' })
    this.startTimer()
  }

  stop(): Promise<{ blob: Blob; durationMs: number }> {
    return new Promise((resolve, reject) => {
      const mediaRecorder = this.mediaRecorder
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        reject(new Error('録音が開始されていません'))
        return
      }
      const mimeType = mediaRecorder.mimeType
      const durationMs =
        mediaRecorder.state === 'paused'
          ? this.state.elapsedMs
          : performance.now() - this.startedAt - this.pausedAccumMs
      mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: mimeType })
        this.cleanup()
        this.setState({ status: 'stopped' })
        resolve({ blob, durationMs })
      }
      this.stopTimer()
      mediaRecorder.stop()
    })
  }

  private cleanup() {
    this.stream?.getTracks().forEach((track) => track.stop())
    void this.audioContext?.close()
    this.stream = null
    this.audioContext = null
    this.analyserNode = null
    this.mediaRecorder = null
  }

  private startTimer() {
    this.stopTimer()
    this.timerId = window.setInterval(() => {
      const elapsedMs = performance.now() - this.startedAt - this.pausedAccumMs
      this.setState({ elapsedMs })
    }, 200)
  }

  private stopTimer() {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId)
      this.timerId = null
    }
  }
}
