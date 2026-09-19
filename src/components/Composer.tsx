import { useRef } from 'react'

type Props = {
  disabled?: boolean
  status?: string
  onSend: (text: string) => void
}

export function Composer({ disabled, status, onSend }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const submit = () => {
    const el = ref.current
    if (!el || disabled) return
    const text = el.value.trim()
    if (!text) return
    onSend(text)
    el.value = ''
    el.style.height = 'auto'
  }

  return (
    <div className="border-t border-zinc-800 bg-zinc-950/90 p-4">
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-2">
        <textarea
          ref={ref}
          rows={1}
          disabled={disabled}
          placeholder="Share what’s here for you…"
          className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 disabled:opacity-50"
          onInput={(e) => {
            const t = e.currentTarget
            t.style.height = 'auto'
            t.style.height = `${t.scrollHeight}px`
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={submit}
          className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status ? '…' : 'Send'}
        </button>
      </div>
      <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-zinc-500">
        {status ?? (
          <>
            Holly offers ACT-style support, not licensed therapy or crisis care. If
            you are in danger, contact local emergency services or call 988 (US).
          </>
        )}
      </p>
    </div>
  )
}
