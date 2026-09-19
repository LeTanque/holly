import { StreamingMarkdown } from './StreamingMarkdown'

type Props = {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

export function MessageBubble({ role, content, streaming }: Props) {
  const isUser = role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div
          className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-900/80 text-sm font-medium text-emerald-100"
          aria-hidden
        >
          H
        </div>
      )}
      <div
        className={`max-w-[min(720px,85%)] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-zinc-800 text-zinc-100'
            : 'border border-zinc-800 bg-zinc-900/80'
        }`}
      >
        {!isUser && (
          <p className="mb-1 text-xs font-medium text-emerald-400/90">Holly</p>
        )}
        <StreamingMarkdown content={content} />
        {streaming && (
          <span className="ml-0.5 inline-block h-4 w-1 animate-pulse bg-emerald-400/80 align-middle" />
        )}
      </div>
    </div>
  )
}
