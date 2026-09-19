import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { asc, eq } from 'drizzle-orm'

import { db } from '../db/index.js'
import {
  messages,
  sessionSummaries,
  sessions,
  workingMemory,
} from '../db/schema.js'
import { chatCompletion } from '../llm/client.js'
import { indexSessionChunks } from './embeddings.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const consolidatePromptPath = path.resolve(
  __dirname,
  '../../prompts/consolidate-system.md',
)

function parseConsolidationOutput(raw: string): {
  sessionSummary: string
  workingMemory: string
} {
  const summaryMatch = raw.match(
    /## SessionSummary\s*([\s\S]*?)(?=## WorkingMemory|$)/i,
  )
  const memoryMatch = raw.match(/## WorkingMemory\s*([\s\S]*)/i)
  const sessionSummary = summaryMatch?.[1]?.trim() ?? raw.trim()
  const wm = memoryMatch?.[1]?.trim() ?? ''
  return { sessionSummary, workingMemory: wm }
}

export async function consolidateSession(sessionId: string): Promise<void> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1)
  if (!session) throw new Error('Session not found')

  const transcript = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.createdAt))

  const dialog = transcript.filter(
    (m) => m.role === 'user' || m.role === 'assistant',
  )
  if (dialog.length === 0) {
    await db
      .update(sessions)
      .set({ consolidatedAt: new Date(), updatedAt: new Date() })
      .where(eq(sessions.id, sessionId))
    return
  }

  const [wmRow] = await db.select().from(workingMemory).limit(1)
  const priorMemory = wmRow?.content ?? ''

  const transcriptText = dialog
    .map((m) => `${m.role === 'user' ? 'Client' : 'Holly'}: ${m.content}`)
    .join('\n\n')

  const systemPrompt = fs.readFileSync(consolidatePromptPath, 'utf8')
  const userContent = `Previous working memory:\n${priorMemory || '(empty)'}\n\n---\n\nSession transcript:\n${transcriptText}`

  const raw = await chatCompletion([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ])

  const { sessionSummary, workingMemory: newMemory } =
    parseConsolidationOutput(raw)

  await db.insert(sessionSummaries).values({
    id: randomUUID(),
    sessionId,
    summary: sessionSummary,
    createdAt: new Date(),
  })

  if (newMemory) {
    if (wmRow) {
      await db
        .update(workingMemory)
        .set({ content: newMemory, updatedAt: new Date() })
        .where(eq(workingMemory.id, wmRow.id))
    } else {
      await db.insert(workingMemory).values({
        content: newMemory,
        updatedAt: new Date(),
      })
    }
  }

  const title =
    sessionSummary.split(/[.!?]/)[0]?.trim().slice(0, 80) || session.title

  await db
    .update(sessions)
    .set({
      title,
      consolidatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId))

  await indexSessionChunks(sessionId)
}
