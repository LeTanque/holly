import { useCallback, useEffect, useState } from 'react'

import {
  consolidateSession,
  createSession,
  fetchMessages,
  fetchSessions,
  fetchWorkingMemory,
  streamChat,
  type Message,
  type Session,
} from './lib/api'
import { ChatThread } from './components/ChatThread'
import { Composer } from './components/Composer'
import { MemoryPanel } from './components/MemoryPanel'
import { SessionSidebar } from './components/SessionSidebar'

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [memoryContent, setMemoryContent] = useState('')

  const loadSessions = useCallback(async () => {
    const list = await fetchSessions()
    setSessions(list)
    return list
  }, [])

  const loadMessages = useCallback(async (sessionId: string) => {
    const msgs = await fetchMessages(sessionId)
    setMessages(msgs)
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const list = await loadSessions()
        if (list.length > 0) {
          setActiveId(list[0]!.id)
          await loadMessages(list[0]!.id)
        } else {
          const created = await createSession()
          setSessions([created])
          setActiveId(created.id)
          await loadMessages(created.id)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      }
    })()
  }, [loadMessages, loadSessions])

  const selectSession = async (id: string) => {
    setActiveId(id)
    setError(null)
    try {
      await loadMessages(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load messages')
    }
  }

  const startNewSession = async () => {
    if (!activeId || busy) return
    setBusy(true)
    setError(null)
    try {
      try {
        await consolidateSession(activeId)
      } catch (consolidateErr) {
        const msg =
          consolidateErr instanceof Error
            ? consolidateErr.message
            : 'Consolidation failed'
        setError(`Memory update skipped: ${msg}`)
      }
      const created = await createSession()
      const list = await loadSessions()
      setSessions(list.length ? list : [created])
      setActiveId(created.id)
      await loadMessages(created.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start session')
    } finally {
      setBusy(false)
    }
  }

  const sendMessage = async (text: string) => {
    if (!activeId || busy) return
    setBusy(true)
    setError(null)
    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      sessionId: activeId,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    setStreaming('')

    try {
      await streamChat(activeId, text, {
        onDelta: (chunk) => setStreaming((s) => (s ?? '') + chunk),
        onDone: () => {},
        onError: (msg) => setError(msg),
      })
      await loadMessages(activeId)
      const list = await loadSessions()
      setSessions(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed')
    } finally {
      setStreaming(null)
      setBusy(false)
    }
  }

  const openMemory = async () => {
    try {
      const wm = await fetchWorkingMemory()
      setMemoryContent(wm.content)
      setMemoryOpen(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load memory')
    }
  }

  return (
    <div className="flex h-full min-h-0">
      <SessionSidebar
        sessions={sessions}
        activeId={activeId}
        onSelect={(id) => void selectSession(id)}
        onNewSession={() => void startNewSession()}
        onShowMemory={() => void openMemory()}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        {error && (
          <div className="border-b border-red-900/50 bg-red-950/40 px-4 py-2 text-sm text-red-200">
            {error}
          </div>
        )}
        <ChatThread messages={messages} streamingContent={streaming} />
        <Composer disabled={busy || !activeId} onSend={(t) => void sendMessage(t)} />
      </main>
      {memoryOpen && (
        <MemoryPanel content={memoryContent} onClose={() => setMemoryOpen(false)} />
      )}
    </div>
  )
}
