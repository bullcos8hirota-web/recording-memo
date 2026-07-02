const WHISPER_SAMPLE_RATE = 16000

/** Decodes an audio Blob into mono Float32 PCM at 16kHz, the format Whisper expects. */
export async function decodeAudioToMono16k(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer()
  const audioContext = new AudioContext()
  let audioBuffer: AudioBuffer
  try {
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
  } finally {
    await audioContext.close()
  }

  const offlineContext = new OfflineAudioContext(
    1,
    Math.ceil(audioBuffer.duration * WHISPER_SAMPLE_RATE),
    WHISPER_SAMPLE_RATE,
  )
  const source = offlineContext.createBufferSource()
  source.buffer = audioBuffer
  source.connect(offlineContext.destination)
  source.start(0)
  const rendered = await offlineContext.startRendering()
  return rendered.getChannelData(0)
}
