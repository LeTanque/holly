import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { desc, eq, ne } from 'drizzle-orm'

import { db } from '../db/index.js'
import {
  messages,
  sessionSummaries,
  sessions,
  workingMemory,
} from '../db/schema.js'
import type { ChatMessage } from '../llm/client.js'
import { retrieveRelevantChunks } from '../memory/embeddings.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const hollyPromptPath = path.resolve(__dirname, '../../prompts/holly-system.md')

const RECENT_MESSAGE_LIMIT = 40

function loadHollySystemPrompt(): string {
  return fs.readFileSync(hollyPromptPath, 'utf8')
}

async function getWorkingMemoryContent(): Promise<string> {
  const [row] = await db.select().from(workingMemory).limit(1)
  return row?.content?.trim() ?? ''
}

async function getRecentSessionSummaries(
  excludeSessionId: string,
  limit = 3,
): Promise<string[]> {
  const rows = await db
    .select({
      summary: sessionSummaries.summary,
      createdAt: sessionSummaries.createdAt,
    })
    .from(sessionSummaries)
    .innerJoin(sessions, eq(sessionSummaries.sessionId, sessions.id))
    .where(ne(sessionSummaries.sessionId, excludeSessionId))
    .orderBy(desc(sessionSummaries.createdAt))
    .limit(limit)

  return rows.map((r) => r.summary)
}

async function getRecentMessages(sessionId: string): Promise<ChatMessage[]> {
  const rows = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(desc(messages.createdAt))
    .limit(RECENT_MESSAGE_LIMIT)

  return rows
    .reverse()
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))
}

export async function buildChatMessages(
  sessionId: string,
  userMessage: string,
): Promise<ChatMessage[]> {
  const systemParts: string[] = [loadHollySystemPrompt()]

  const wm = await getWorkingMemoryContent()
  if (wm) {
    systemParts.push(
      `\n\n---\n## Continuity (what you remember across sessions)\n${wm}`,
    )
  }

  const summaries = await getRecentSessionSummaries(sessionId)
  if (summaries.length > 0) {
    systemParts.push(
      `\n\n---\n## Recent session summaries\n${summaries.map((s, i) => `### Session ${i + 1}\n${s}`).join('\n\n')}`,
    )
  }

  const retrieved = await retrieveRelevantChunks(userMessage, wm, 5)
  if (retrieved.length > 0) {
    systemParts.push(
      `\n\n---\n## Retrieved moments from earlier conversations\n${retrieved.map((c) => `- ${c}`).join('\n')}`,
    )
  }

  const history = await getRecentMessages(sessionId)
  const chatMessages: ChatMessage[] = [
    { role: 'system', content: systemParts.join('') },
    ...history,
    { role: 'user', content: userMessage },
  ]

  return chatMessages
}
