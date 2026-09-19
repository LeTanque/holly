import { randomUUID } from 'node:crypto'
import { asc, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '../db/index.js'
import { messages, sessions, workingMemory } from '../db/schema.js'
import { consolidateSession } from '../memory/consolidate.js'

const OPENING =
  'What\u2019s showing up for you right now that you\u2019d like to explore together?'

export const sessionsRoute = new Hono()

sessionsRoute.get('/', async (c) => {
  const rows = await db
    .select()
    .from(sessions)
    .orderBy(desc(sessions.updatedAt))
  return c.json(rows)
})

sessionsRoute.post('/', async (c) => {
  const priorSessionCount = (
    await db.select({ id: sessions.id }).from(sessions)
  ).length

  const [wm] = await db.select().from(workingMemory).limit(1)
  const hasPriorMemory = Boolean(wm?.content?.trim())

  const id = randomUUID()
  const now = new Date()
  await db.insert(sessions).values({
    id,
    title: 'New session',
    createdAt: now,
    updatedAt: now,
  })

  if (!hasPriorMemory && priorSessionCount === 0) {
    await db.insert(messages).values({
      id: randomUUID(),
      sessionId: id,
      role: 'assistant',
      content: OPENING,
      createdAt: now,
    })
  }

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))
    .limit(1)
  return c.json(session, 201)
})

sessionsRoute.get('/:id/messages', async (c) => {
  const sessionId = c.req.param('id')
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.createdAt))
  return c.json(rows)
})

sessionsRoute.post('/:id/consolidate', async (c) => {
  const sessionId = c.req.param('id')
  await consolidateSession(sessionId)
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1)
  return c.json({ ok: true, session })
})
