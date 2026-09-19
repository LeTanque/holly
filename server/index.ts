import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { runMigrations } from './db/index.js'
import { chatRoute } from './routes/chat.js'
import { memoryRoute } from './routes/memory.js'
import { sessionsRoute } from './routes/sessions.js'

runMigrations()

const app = new Hono()
app.use('/api/*', cors())

app.get('/api/health', (c) => c.json({ ok: true }))

app.route('/api/sessions', sessionsRoute)
app.route('/api/chat', chatRoute)
app.route('/api/memory', memoryRoute)

const port = Number(process.env.PORT) || 3011

serve({ fetch: app.fetch, port }, () => {
  console.log(`Holly API listening on http://127.0.0.1:${port}`)
})
