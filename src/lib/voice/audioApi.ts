export type AudioCapabilities = {
  serverAudio: boolean
  sttModel: string
  ttsModel: string
  ttsVoice: string
}

let capabilitiesCache: AudioCapabilities | null = null

export async function fetchAudioCapabilities(): Promise<AudioCapabilities> {
  if (capabilitiesCache) return capabilitiesCache
  try {
    const res = await fetch('/api/audio/capabilities')
    if (!res.ok) throw new Error('capabilities unavailable')
    capabilitiesCache = (await res.json()) as AudioCapabilities
    return capabilitiesCache
  } catch {
    const fallback: AudioCapabilities = {
      serverAudio: false,
      sttModel: 'whisper-1',
      ttsModel: 'tts-1',
      ttsVoice: 'nova',
    }
    capabilitiesCache = fallback
    return fallback
  }
}

export function clearAudioCapabilitiesCache(): void {
  capabilitiesCache = null
}

export async function transcribeBlob(blob: Blob, mimeType: string): Promise<string> {
  const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'mp4' : 'ogg'
  const form = new FormData()
  form.append('file', blob, `recording.${ext}`)

  const res = await fetch('/api/audio/transcribe', {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || res.statusText)
  }

  const data = (await res.json()) as { text: string }
  return data.text
}

export async function fetchSpeechAudio(
  text: string,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const res = await fetch('/api/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal,
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || res.statusText)
  }

  return res.arrayBuffer()
}
