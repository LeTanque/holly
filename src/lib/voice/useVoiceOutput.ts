import { useCallback, useRef, useState } from 'react'

import { fetchAudioCapabilities, fetchSpeechAudio } from './audioApi'
import { plainTextForSpeech } from './plainText'
import { canUseWebSpeechSynthesis, speakWithWebSpeech, stopWebSpeech } from './webSpeech'

export type VoiceOutputPhase = 'idle' | 'loading' | 'playing'

export function useVoiceOutput() {
  const [phase, setPhase] = useState<VoiceOutputPhase>('idle')
  const generationRef = useRef(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const stopSynthRef = useRef<(() => void) | null>(null)
  const playSettleRef = useRef<(() => void) | null>(null)

  const voiceActive = phase !== 'idle'

  const cleanupAudio = useCallback(() => {
    if (playSettleRef.current) {
      playSettleRef.current()
      playSettleRef.current = null
    }
    const audio = audioRef.current
    if (audio) {
      audio.onended = null
      audio.onerror = null
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      audioRef.current = null
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  const cancelInFlight = useCallback(() => {
    generationRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    cleanupAudio()
    stopSynthRef.current?.()
    stopSynthRef.current = null
    stopWebSpeech()
  }, [cleanupAudio])

  const stop = useCallback(() => {
    cancelInFlight()
    setPhase('idle')
  }, [cancelInFlight])

  const isCurrentGeneration = useCallback((gen: number) => generationRef.current === gen, [])

  const speakWithBrowser = useCallback(
    async (text: string, gen: number) => {
      if (!isCurrentGeneration(gen)) return

      if (!canUseWebSpeechSynthesis()) {
        if (isCurrentGeneration(gen)) setPhase('idle')
        return
      }

      setPhase('playing')
      const { stop: stopSynth, done } = speakWithWebSpeech(text)
      stopSynthRef.current = stopSynth

      try {
        await done
      } catch {
        // synthesis error or cancelled
      } finally {
        stopSynthRef.current = null
        if (isCurrentGeneration(gen)) setPhase('idle')
      }
    },
    [isCurrentGeneration],
  )

  const speak = useCallback(
    async (markdownOrText: string) => {
      const text = plainTextForSpeech(markdownOrText)
      if (!text) return

      cancelInFlight()
      const gen = generationRef.current
      const abort = new AbortController()
      abortRef.current = abort
      setPhase('loading')

      const stale = () => !isCurrentGeneration(gen) || abort.signal.aborted

      try {
        const caps = await fetchAudioCapabilities()
        if (stale()) return

        if (caps.serverAudio) {
          try {
            const buffer = await fetchSpeechAudio(text, abort.signal)
            if (stale()) return

            const blob = new Blob([buffer], { type: 'audio/mpeg' })
            const url = URL.createObjectURL(blob)
            objectUrlRef.current = url
            const audio = new Audio(url)
            audioRef.current = audio
            setPhase('playing')

            await new Promise<void>((resolve) => {
              const settle = () => {
                if (playSettleRef.current !== settle) return
                playSettleRef.current = null
                cleanupAudio()
                if (isCurrentGeneration(gen)) setPhase('idle')
                resolve()
              }
              playSettleRef.current = settle

              audio.onended = settle
              audio.onerror = settle
              void audio.play().catch(settle)
            })
            return
          } catch (e) {
            if (stale() || (e instanceof DOMException && e.name === 'AbortError')) return
            await speakWithBrowser(text, gen)
            return
          }
        }

        await speakWithBrowser(text, gen)
      } catch {
        if (isCurrentGeneration(gen)) setPhase('idle')
      } finally {
        if (abortRef.current === abort) abortRef.current = null
      }
    },
    [cancelInFlight, cleanupAudio, isCurrentGeneration, speakWithBrowser],
  )

  return {
    phase,
    voiceActive,
    /** @deprecated use voiceActive — kept for callers using `speaking` */
    speaking: voiceActive,
    speak,
    stop,
  }
}
