import { useEffect, useRef } from 'react'

interface WaveformProps {
  analyser: AnalyserNode | null
  active: boolean
}

export function Waveform({ analyser, active }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !analyser || !active) return

    const bufferLength = analyser.fftSize
    const data = new Uint8Array(bufferLength)
    let rafId: number

    const draw = () => {
      rafId = requestAnimationFrame(draw)
      analyser.getByteTimeDomainData(data)

      const { width, height } = canvas
      ctx.clearRect(0, 0, width, height)
      ctx.lineWidth = 2
      ctx.strokeStyle = '#dc2626'
      ctx.beginPath()

      const sliceWidth = width / bufferLength
      let x = 0
      for (let i = 0; i < bufferLength; i++) {
        const v = data[i] / 128.0
        const y = (v * height) / 2
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
        x += sliceWidth
      }
      ctx.stroke()
    }

    draw()
    return () => cancelAnimationFrame(rafId)
  }, [analyser, active])

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={80}
      className="h-20 w-full rounded bg-neutral-100 dark:bg-neutral-800"
    />
  )
}
