import 'dotenv/config'

export type ChatRole = 'system' | 'user' | 'assistant'

export type ChatMessage = {
  role: ChatRole
  content: string
}

function llmConfig() {
  const apiKey = process.env.LLM_API_KEY
  if (!apiKey) {
    throw new Error('LLM_API_KEY is not set. Copy .env.example to .env and add your key.')
  }
  const baseUrl = (process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(
    /\/$/,
    '',
  )
  const model = process.env.LLM_MODEL || 'gpt-5-mini'
  return { apiKey, baseUrl, model }
}

/** Only sent when LLM_TEMPERATURE is set — many models (e.g. gpt-5, o-series) reject non-default values. */
function temperatureFromEnv(): number | undefined {
  const raw = process.env.LLM_TEMPERATURE
  if (raw === undefined || raw.trim() === '') return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

function completionBody(
  model: string,
  messages: ChatMessage[],
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  const body: Record<string, unknown> = { model, messages, ...extra }
  const temperature = temperatureFromEnv()
  if (temperature !== undefined) body.temperature = temperature
  return body
}

export async function chatCompletion(messages: ChatMessage[]): Promise<string> {
  const { apiKey, baseUrl, model } = llmConfig()

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(completionBody(model, messages)),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`LLM request failed (${res.status}): ${text}`)
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('LLM returned empty content')
  return content
}

export async function* streamChatCompletion(
  messages: ChatMessage[],
): AsyncGenerator<string> {
  const { apiKey, baseUrl, model } = llmConfig()

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(completionBody(model, messages, { stream: true })),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`LLM stream failed (${res.status}): ${text}`)
  }

  if (!res.body) throw new Error('LLM stream has no body')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') return
      try {
        const parsed = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[]
        }
        const delta = parsed.choices?.[0]?.delta?.content
        if (delta) yield delta
      } catch {
        // skip malformed SSE chunks
      }
    }
  }
}
