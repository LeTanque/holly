import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  title: text('title').notNull().default('New session'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  consolidatedAt: integer('consolidated_at', { mode: 'timestamp_ms' }),
})

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

export const workingMemory = sqliteTable('working_memory', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  content: text('content').notNull().default(''),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export const sessionSummaries = sqliteTable('session_summaries', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  summary: text('summary').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

export const memoryChunks = sqliteTable('memory_chunks', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  startMessageId: text('start_message_id'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

export const chunkEmbeddings = sqliteTable('chunk_embeddings', {
  chunkId: text('chunk_id')
    .primaryKey()
    .references(() => memoryChunks.id, { onDelete: 'cascade' }),
  embedding: text('embedding').notNull(),
})
