import { useCallback, useEffect, useRef, useState } from 'react'

import { getSpeakRepliesEnabled } from './lib/voice/settings'
import { useVoiceOutput } from './lib/voice/useVoiceOutput'

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
  const [hollyThinking, setHollyThinking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [memoryContent, setMemoryContent] = useState('')
  const [speakReplies, setSpeakReplies] = useState(() => getSpeakRepliesEnabled())
  const { speak, stop, voiceActive, phase: voicePhase } = useVoiceOutput()
  const lastReplyRef = useRef('')
  const [memorySyncing, setMemorySyncing] = useState(false)
  const consolidateQueue = useRef(Promise.resolve())

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stop()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [stop])

  const loadSessions = useCallback(async () => {
    const list = await fetchSessions()
    setSessions(list)
    return list
  }, [])

  const enqueueConsolidate = useCallback(
    (sessionId: string) => {
      consolidateQueue.current = consolidateQueue.current
        .then(async () => {
          setMemorySyncing(true)
          await consolidateSession(sessionId)
        })
        .catch((e) => {
          const msg = e instanceof Error ? e.message : 'Consolidation failed'
          setError(`Memory update skipped: ${msg}`)
        })
        .finally(() => {
          setMemorySyncing(false)
          void loadSessions()
        })
    },
    [loadSessions],
  )

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
    const previousId = activeId
    setBusy(true)
    setError(null)
    try {
      const created = await createSession()
      setActiveId(created.id)
      await loadMessages(created.id)
      const list = await loadSessions()
      setSessions(list.length ? list : [created])
      enqueueConsolidate(previousId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start session')
    } finally {
      setBusy(false)
    }
  }

  const sendMessage = async (text: string) => {
    if (!activeId || busy) return
    stop()
    setBusy(true)
    setError(null)
    lastReplyRef.current = ''
    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      sessionId: activeId,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    setStreaming(null)
    setHollyThinking(true)

    try {
      await streamChat(activeId, text, {
        onDelta: (chunk) => {
          setHollyThinking(false)
          lastReplyRef.current += chunk
          setStreaming((s) => (s ?? '') + chunk)
        },
        onDone: () => {},
        onError: (msg) => setError(msg),
      })
      if (getSpeakRepliesEnabled() && lastReplyRef.current.trim()) {
        void speak(lastReplyRef.current)
      }
      await loadMessages(activeId)
      const list = await loadSessions()
      setSessions(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed')
    } finally {
      setStreaming(null)
      setHollyThinking(false)
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
        newSessionDisabled={busy || !activeId}
        newSessionLabel={busy ? 'Starting…' : 'New session'}
        memorySyncing={memorySyncing}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        {error && (
          <div className="border-b border-red-900/50 bg-red-950/40 px-4 py-2 text-sm text-red-200">
            {error}
          </div>
        )}
        <ChatThread
          messages={messages}
          hollyThinking={hollyThinking}
          streamingContent={streaming}
        />
        {voiceActive && (
          <div
            className="flex items-center justify-between gap-3 border-t border-amber-900/50 bg-amber-950/60 px-4 py-3"
            role="status"
            aria-live="polite"
          >
            <p className="text-sm font-medium text-amber-100">
              {voicePhase === 'loading'
                ? 'Preparing Holly’s voice…'
                : 'Holly is speaking…'}
            </p>
            <button
              type="button"
              onClick={() => stop()}
              className="min-h-11 shrink-0 rounded-xl bg-red-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-950/40 transition hover:bg-red-500 active:bg-red-700"
            >
              Stop
            </button>
          </div>
        )}
        <Composer
          disabled={busy || !activeId}
          status={
            memorySyncing
              ? 'Updating memory from previous session…'
              : hollyThinking
                ? 'Holly is reflecting…'
                : undefined
          }
          onSend={(t) => void sendMessage(t)}
          onRecordingStart={() => stop()}
          speakReplies={speakReplies}
          onSpeakRepliesChange={setSpeakReplies}
          voiceActive={voiceActive}
          voicePhase={voicePhase}
          onStopSpeaking={() => stop()}
        />
      </main>
      {memoryOpen && (
        <MemoryPanel content={memoryContent} onClose={() => setMemoryOpen(false)} />
      )}
    </div>
  )
}
