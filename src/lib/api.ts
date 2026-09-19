export type Session = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  consolidatedAt: string | null
}

export type Message = {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }
  return res.json() as Promise<T>
}

export async function fetchSessions(): Promise<Session[]> {
  return parseJson(await fetch('/api/sessions'))
}

export async function createSession(): Promise<Session> {
  return parseJson(
    await fetch('/api/sessions', { method: 'POST' }),
  )
}

export async function fetchMessages(sessionId: string): Promise<Message[]> {
  return parseJson(await fetch(`/api/sessions/${sessionId}/messages`))
}

export async function consolidateSession(sessionId: string): Promise<void> {
  await parseJson(
    await fetch(`/api/sessions/${sessionId}/consolidate`, { method: 'POST' }),
  )
}

export async function fetchWorkingMemory(): Promise<{
  content: string
  updatedAt: string | null
}> {
  return parseJson(await fetch('/api/memory/working-memory'))
}

export async function streamChat(
  sessionId: string,
  message: string,
  handlers: {
    onDelta: (text: string) => void
    onDone: () => void
    onError: (message: string) => void
  },
): Promise<void> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message }),
  })

  if (!res.ok || !res.body) {
    handlers.onError(await res.text())
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      for (const line of part.split('\n')) {
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        try {
          const event = JSON.parse(payload) as {
            type: string
            text?: string
            message?: string
          }
          if (event.type === 'delta' && event.text) handlers.onDelta(event.text)
          if (event.type === 'done') handlers.onDone()
          if (event.type === 'error')
            handlers.onError(event.message ?? 'Unknown error')
        } catch {
          // ignore
        }
      }
    }
  }
}
