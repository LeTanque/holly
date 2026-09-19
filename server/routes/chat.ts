import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'

import { buildChatMessages } from '../context/buildPrompt.js'
import { db } from '../db/index.js'
import { messages, sessions } from '../db/schema.js'
import { streamChatCompletion } from '../llm/client.js'

export const chatRoute = new Hono()

chatRoute.post('/', async (c) => {
  const body = (await c.req.json()) as {
    sessionId?: string
    message?: string
  }
  const sessionId = body.sessionId?.trim()
  const userText = body.message?.trim()

  if (!sessionId || !userText) {
    return c.json({ error: 'sessionId and message are required' }, 400)
  }

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1)
  if (!session) return c.json({ error: 'Session not found' }, 404)

  const userMessageId = randomUUID()
  const now = new Date()
  await db.insert(messages).values({
    id: userMessageId,
    sessionId,
    role: 'user',
    content: userText,
    createdAt: now,
  })
  await db
    .update(sessions)
    .set({ updatedAt: now })
    .where(eq(sessions.id, sessionId))

  const llmMessages = await buildChatMessages(sessionId, userText)
  const assistantMessageId = randomUUID()

  return streamSSE(c, async (stream) => {
    let full = ''
    try {
      for await (const chunk of streamChatCompletion(llmMessages)) {
        full += chunk
        await stream.writeSSE({ data: JSON.stringify({ type: 'delta', text: chunk }) })
      }

      await db.insert(messages).values({
        id: assistantMessageId,
        sessionId,
        role: 'assistant',
        content: full,
        createdAt: new Date(),
      })
      await db
        .update(sessions)
        .set({ updatedAt: new Date() })
        .where(eq(sessions.id, sessionId))

      await stream.writeSSE({
        data: JSON.stringify({
          type: 'done',
          messageId: assistantMessageId,
        }),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Stream failed'
      await stream.writeSSE({
        data: JSON.stringify({ type: 'error', message }),
      })
    }
  })
})
