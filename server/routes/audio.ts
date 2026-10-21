import { Hono } from 'hono'

function audioConfig() {
  const apiKey = process.env.LLM_API_KEY?.trim()
  const baseUrl = (process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(
    /\/$/,
    '',
  )
  const sttModel = process.env.LLM_STT_MODEL || 'whisper-1'
  const ttsModel = process.env.LLM_TTS_MODEL || 'tts-1'
  const ttsVoice = process.env.LLM_TTS_VOICE || 'nova'
  return { apiKey, baseUrl, sttModel, ttsModel, ttsVoice }
}

export const audioRoute = new Hono()

audioRoute.get('/capabilities', (c) => {
  const { apiKey, sttModel, ttsModel, ttsVoice } = audioConfig()
  return c.json({
    serverAudio: Boolean(apiKey),
    sttModel,
    ttsModel,
    ttsVoice,
  })
})

audioRoute.post('/transcribe', async (c) => {
  const { apiKey, baseUrl, sttModel } = audioConfig()
  if (!apiKey) {
    return c.json({ error: 'Server audio is not configured' }, 503)
  }

  const body = await c.req.parseBody()
  const file = body.file
  if (!file || typeof file === 'string') {
    return c.json({ error: 'Missing audio file' }, 400)
  }

  const upload = new FormData()
  upload.append('file', file, file.name || 'recording.webm')
  upload.append('model', sttModel)

  const res = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: upload,
  })

  if (!res.ok) {
    const text = await res.text()
    return c.json({ error: `Transcription failed (${res.status}): ${text}` }, 502)
  }

  const data = (await res.json()) as { text?: string }
  const text = data.text?.trim()
  if (!text) {
    return c.json({ error: 'Transcription returned empty text' }, 502)
  }

  return c.json({ text })
})

audioRoute.post('/speech', async (c) => {
  const { apiKey, baseUrl, ttsModel, ttsVoice } = audioConfig()
  if (!apiKey) {
    return c.json({ error: 'Server audio is not configured' }, 503)
  }

  let payload: { text?: string }
  try {
    payload = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const text = payload.text?.trim()
  if (!text) {
    return c.json({ error: 'Missing text' }, 400)
  }

  const res = await fetch(`${baseUrl}/audio/speech`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ttsModel,
      voice: ttsVoice,
      input: text,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    return c.json({ error: `Speech failed (${res.status}): ${errText}` }, 502)
  }

  const audio = await res.arrayBuffer()
  return new Response(audio, {
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  })
})
