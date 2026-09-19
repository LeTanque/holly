import { useEffect, useRef } from 'react'

import type { Message } from '../lib/api'
import { MessageBubble } from './MessageBubble'
import { ThinkingIndicator } from './ThinkingIndicator'

type Props = {
  messages: Message[]
  hollyThinking?: boolean
  streamingContent?: string | null
}

export function ChatThread({
  messages,
  hollyThinking,
  streamingContent,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent, hollyThinking])

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {messages.map((m) =>
          m.role === 'user' || m.role === 'assistant' ? (
            <MessageBubble key={m.id} role={m.role} content={m.content} />
          ) : null,
        )}
        {hollyThinking && <ThinkingIndicator />}
        {streamingContent != null && streamingContent !== '' && (
          <MessageBubble
            role="assistant"
            content={streamingContent}
            streaming
          />
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
