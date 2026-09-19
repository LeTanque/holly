import { randomUUID } from 'node:crypto'
import { asc, eq } from 'drizzle-orm'

import { db } from '../db/index.js'
import { chunkEmbeddings, memoryChunks, messages } from '../db/schema.js'

const CHUNK_SIZE = 6
let embedderPromise: Promise<(text: string) => Promise<number[]>> | null = null

async function getEmbedder(): Promise<(text: string) => Promise<number[]>> {
  if (!embedderPromise) {
    embedderPromise = (async () => {
      const { pipeline } = await import('@xenova/transformers')
      const extractor = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
      )
      return async (text: string) => {
        const output = await extractor(text, { pooling: 'mean', normalize: true })
        return Array.from(output.data as Float32Array)
      }
    })()
  }
  return embedderPromise
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!
  return dot
}

function parseEmbedding(raw: string): number[] {
  return JSON.parse(raw) as number[]
}

export async function indexSessionChunks(sessionId: string): Promise<void> {
  const existing = await db
    .select({ id: memoryChunks.id })
    .from(memoryChunks)
    .where(eq(memoryChunks.sessionId, sessionId))
  for (const row of existing) {
    await db.delete(chunkEmbeddings).where(eq(chunkEmbeddings.chunkId, row.id))
  }
  await db.delete(memoryChunks).where(eq(memoryChunks.sessionId, sessionId))

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.createdAt))

  const dialog = rows.filter((m) => m.role === 'user' || m.role === 'assistant')
  if (dialog.length === 0) return

  const embed = await getEmbedder()

  for (let i = 0; i < dialog.length; i += CHUNK_SIZE) {
    const slice = dialog.slice(i, i + CHUNK_SIZE)
    const text = slice
      .map((m) => `${m.role === 'user' ? 'Client' : 'Holly'}: ${m.content}`)
      .join('\n\n')
    const chunkId = randomUUID()
    await db.insert(memoryChunks).values({
      id: chunkId,
      sessionId,
      text,
      startMessageId: slice[0]?.id ?? null,
      createdAt: new Date(),
    })
    const vector = await embed(text)
    await db.insert(chunkEmbeddings).values({
      chunkId,
      embedding: JSON.stringify(vector),
    })
  }
}

export async function retrieveRelevantChunks(
  query: string,
  workingMemory: string,
  topK: number,
): Promise<string[]> {
  const rows = await db
    .select({
      text: memoryChunks.text,
      embedding: chunkEmbeddings.embedding,
    })
    .from(memoryChunks)
    .innerJoin(chunkEmbeddings, eq(memoryChunks.id, chunkEmbeddings.chunkId))

  if (rows.length === 0) return []

  const embed = await getEmbedder()
  const queryText = [query, workingMemory.slice(0, 500)].filter(Boolean).join('\n')
  const queryVector = await embed(queryText)

  const scored = rows
    .map((row) => ({
      text: row.text,
      score: cosineSimilarity(queryVector, parseEmbedding(row.embedding)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((r) => r.score > 0.25)

  return scored.map((s) => s.text)
}
