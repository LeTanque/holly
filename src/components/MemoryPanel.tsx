type Props = {
  content: string
  onClose: () => void
}

export function MemoryPanel({ content, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-labelledby="memory-title"
        className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h2 id="memory-title" className="text-sm font-semibold text-zinc-100">
            What Holly remembers
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            Close
          </button>
        </div>
        <div className="overflow-y-auto p-4">
          {content.trim() ? (
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-300">
              {content}
            </pre>
          ) : (
            <p className="text-sm text-zinc-500">
              Holly has not consolidated any cross-session memory yet. Finish a
              session and start a new one to build continuity.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
