import { useEffect, useRef, useState } from 'react'

import {
  getAutoSendAfterVoice,
  getSpeakRepliesEnabled,
  setAutoSendAfterVoice,
  setSpeakRepliesEnabled,
} from '../lib/voice/settings'
import { useVoiceInput } from '../lib/voice/useVoiceInput'

type Props = {
  disabled?: boolean
  status?: string
  onSend: (text: string) => void
  onRecordingStart?: () => void
  speakReplies?: boolean
  onSpeakRepliesChange?: (enabled: boolean) => void
  speaking?: boolean
  onStopSpeaking?: () => void
}

export function Composer({
  disabled,
  status,
  onSend,
  onRecordingStart,
  speakReplies: speakRepliesProp,
  onSpeakRepliesChange,
  speaking,
  onStopSpeaking,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [speakReplies, setSpeakRepliesLocal] = useState(() => getSpeakRepliesEnabled())
  const [autoSendVoice, setAutoSendVoice] = useState(() => getAutoSendAfterVoice())
  const speakRepliesEnabled = speakRepliesProp ?? speakReplies

  const setText = (text: string) => {
    const el = ref.current
    if (!el) return
    el.value = text
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  const submit = () => {
    const el = ref.current
    if (!el || disabled) return
    const text = el.value.trim()
    if (!text) return
    onSend(text)
    el.value = ''
    el.style.height = 'auto'
  }

  const {
    state: voiceState,
    startRecording,
    stopRecording,
    cancelRecording,
    clearError: clearVoiceError,
  } = useVoiceInput({
    onRecordingStart,
    onPartialTranscript: (partial) => {
      if (partial) setText(partial)
    },
    onTranscript: (text) => {
      setText(text)
      if (autoSendVoice && text.trim()) {
        onSend(text.trim())
        const el = ref.current
        if (el) {
          el.value = ''
          el.style.height = 'auto'
        }
      }
    },
  })

  const toggleSpeak = () => {
    const next = !speakRepliesEnabled
    setSpeakRepliesLocal(next)
    setSpeakRepliesEnabled(next)
    onSpeakRepliesChange?.(next)
    if (!next) onStopSpeaking?.()
  }

  const toggleAutoSend = () => {
    const next = !autoSendVoice
    setAutoSendVoice(next)
    setAutoSendAfterVoice(next)
  }

  useEffect(() => {
    if (voiceState.error) {
      const t = window.setTimeout(() => clearVoiceError(), 8000)
      return () => window.clearTimeout(t)
    }
  }, [voiceState.error, clearVoiceError])

  const voiceBusy = voiceState.phase !== 'idle'
  const controlsDisabled = disabled || voiceBusy

  const micLabel =
    voiceState.phase === 'recording'
      ? 'Stop recording'
      : voiceState.phase === 'transcribing'
        ? 'Transcribing…'
        : 'Record voice'

  const footerStatus =
    status ??
    voiceState.error ??
    (voiceState.phase === 'recording'
      ? 'Listening… tap stop when finished.'
      : voiceState.phase === 'transcribing'
        ? 'Transcribing your voice…'
        : null)

  return (
    <div className="border-t border-zinc-800 bg-zinc-950/90 p-4">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 pb-2 text-xs text-zinc-500">
        <label className="flex cursor-pointer items-center gap-2 select-none">
          <input
            type="checkbox"
            checked={speakRepliesEnabled}
            onChange={toggleSpeak}
            className="rounded border-zinc-600 bg-zinc-900 text-emerald-600 focus:ring-emerald-600/40"
          />
          <span>Speak replies</span>
        </label>
        {speaking && (
          <button
            type="button"
            onClick={onStopSpeaking}
            className="rounded-lg border border-zinc-700 px-2 py-1 text-zinc-300 hover:bg-zinc-900"
          >
            Stop speaking
          </button>
        )}
        <label className="flex cursor-pointer items-center gap-2 select-none">
          <input
            type="checkbox"
            checked={autoSendVoice}
            onChange={toggleAutoSend}
            className="rounded border-zinc-600 bg-zinc-900 text-emerald-600 focus:ring-emerald-600/40"
          />
          <span>Auto-send after voice</span>
        </label>
      </div>
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-2">
        <div className="flex shrink-0 flex-col gap-1">
          {voiceState.phase === 'recording' ? (
            <>
              <button
                type="button"
                onClick={stopRecording}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-900/80 text-red-100 ring-2 ring-red-500/60 animate-pulse"
                title={micLabel}
                aria-label={micLabel}
              >
                <MicIcon active />
              </button>
              <button
                type="button"
                onClick={cancelRecording}
                className="rounded-lg px-1 py-0.5 text-[10px] text-zinc-500 hover:text-zinc-300"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={controlsDisabled || !voiceState.canUseMic}
              onClick={() => void startRecording()}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-700 text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
              title={
                !voiceState.canUseMic && voiceState.blockReason
                  ? voiceState.error ?? micLabel
                  : micLabel
              }
              aria-label={micLabel}
            >
              {voiceState.phase === 'transcribing' ? (
                <span className="text-xs text-zinc-400">…</span>
              ) : (
                <MicIcon active={false} />
              )}
            </button>
          )}
        </div>
        <textarea
          ref={ref}
          rows={1}
          disabled={controlsDisabled}
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
          disabled={controlsDisabled}
          onClick={submit}
          className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status ? '…' : 'Send'}
        </button>
      </div>
      <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-zinc-500">
        {footerStatus ?? (
          <>
            Holly offers ACT-style support, not licensed therapy or crisis care. If
            you are in danger, contact local emergency services or call 988 (US).
          </>
        )}
      </p>
    </div>
  )
}

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`h-5 w-5 ${active ? '' : 'opacity-90'}`}
      aria-hidden
    >
      <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
    </svg>
  )
}
