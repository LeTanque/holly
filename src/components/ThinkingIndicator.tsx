export function ThinkingIndicator() {
  return (
    <div
      className="flex gap-3 justify-start"
      role="status"
      aria-live="polite"
      aria-label="Holly is thinking"
    >
      <div
        className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-900/80 text-sm font-medium text-emerald-100"
        aria-hidden
      >
        H
      </div>
      <div className="max-w-[min(720px,85%)] rounded-2xl border border-zinc-800 bg-zinc-900/80 px-4 py-3">
        <p className="mb-2 text-xs font-medium text-emerald-400/90">Holly</p>
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <span className="flex gap-1" aria-hidden>
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="h-2 w-2 animate-bounce rounded-full bg-emerald-500/80"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </span>
          <span>Reflecting…</span>
        </div>
      </div>
    </div>
  )
}
