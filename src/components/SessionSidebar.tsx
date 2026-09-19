import type { Session } from '../lib/api'

type Props = {
  sessions: Session[]
  activeId: string | null
  onSelect: (id: string) => void
  onNewSession: () => void
  onShowMemory: () => void
}

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function SessionSidebar({
  sessions,
  activeId,
  onSelect,
  onNewSession,
  onShowMemory,
}: Props) {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 p-4">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-50">
          Holly
        </h1>
        <p className="mt-0.5 text-xs text-zinc-500">ACT therapy companion</p>
        <button
          type="button"
          onClick={onNewSession}
          className="mt-4 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-100 hover:border-zinc-600 hover:bg-zinc-800"
        >
          New session
        </button>
        <button
          type="button"
          onClick={onShowMemory}
          className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
        >
          What Holly remembers
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {sessions.length === 0 && (
          <p className="px-2 py-4 text-sm text-zinc-500">No sessions yet.</p>
        )}
        <ul className="space-y-1">
          {sessions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                className={`w-full rounded-lg px-3 py-2 text-left transition ${
                  s.id === activeId
                    ? 'bg-zinc-800 text-zinc-50'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <span className="line-clamp-2 text-sm font-medium">{s.title}</span>
                <span className="mt-0.5 block text-xs text-zinc-500">
                  {formatWhen(s.updatedAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
