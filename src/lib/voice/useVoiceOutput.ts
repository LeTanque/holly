import { useCallback, useRef, useState } from 'react'

import { fetchAudioCapabilities, fetchSpeechAudio } from './audioApi'
import { plainTextForSpeech } from './plainText'
import { canUseWebSpeechSynthesis, speakWithWebSpeech, stopWebSpeech } from './webSpeech'

export function useVoiceOutput() {
  const [speaking, setSpeaking] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const stopSynthRef = useRef<(() => void) | null>(null)

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    stopSynthRef.current?.()
    stopSynthRef.current = null
    stopWebSpeech()
    setSpeaking(false)
  }, [])

  const speakWithBrowser = useCallback(async (text: string) => {
    if (!canUseWebSpeechSynthesis()) {
      setSpeaking(false)
      return
    }
    const { stop: stopSynth, done } = speakWithWebSpeech(text)
    stopSynthRef.current = stopSynth
    try {
      await done
    } catch {
      // ignore synthesis errors
    } finally {
      stopSynthRef.current = null
      setSpeaking(false)
    }
  }, [])

  const speak = useCallback(
    async (markdownOrText: string) => {
      stop()
      const text = plainTextForSpeech(markdownOrText)
      if (!text) return

      setSpeaking(true)

      const caps = await fetchAudioCapabilities()
      if (caps.serverAudio) {
        try {
          const buffer = await fetchSpeechAudio(text)
          const blob = new Blob([buffer], { type: 'audio/mpeg' })
          const url = URL.createObjectURL(blob)
          const audio = new Audio(url)
          audioRef.current = audio

          await new Promise<void>((resolve, reject) => {
            audio.onended = () => {
              URL.revokeObjectURL(url)
              audioRef.current = null
              setSpeaking(false)
              resolve()
            }
            audio.onerror = () => {
              URL.revokeObjectURL(url)
              audioRef.current = null
              reject(new Error('audio_playback_failed'))
            }
            void audio.play().catch(reject)
          })
          return
        } catch {
          await speakWithBrowser(text)
          return
        }
      }

      await speakWithBrowser(text)
    },
    [speakWithBrowser, stop],
  )

  return { speaking, speak, stop }
}
