import { Hono } from 'hono'

import { db } from '../db/index.js'
import { workingMemory } from '../db/schema.js'

export const memoryRoute = new Hono()

memoryRoute.get('/working-memory', async (c) => {
  const [row] = await db.select().from(workingMemory).limit(1)
  return c.json({
    content: row?.content ?? '',
    updatedAt: row?.updatedAt ?? null,
  })
})
