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
  const model = process.env.LLM_MODEL || 'gpt-4o-mini'
  return { apiKey, baseUrl, model }
}

export async function chatCompletion(
  messages: ChatMessage[],
  options?: { temperature?: number },
): Promise<string> {
  const { apiKey, baseUrl, model } = llmConfig()

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
    }),
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
  options?: { temperature?: number },
): AsyncGenerator<string> {
  const { apiKey, baseUrl, model } = llmConfig()

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      stream: true,
    }),
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
