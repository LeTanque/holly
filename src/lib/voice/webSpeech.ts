type SpeechRecognitionCtor = new () => SpeechRecognitionInstance

type SpeechRecognitionInstance = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((ev: SpeechRecognitionResultEvent) => void) | null
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionResultEvent = {
  results: SpeechRecognitionResultList
}

type SpeechRecognitionResultList = {
  length: number
  [index: number]: SpeechRecognitionResult
}

type SpeechRecognitionResult = {
  isFinal: boolean
  [index: number]: { transcript: string }
}

type SpeechRecognitionErrorEvent = {
  error: string
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function canUseWebSpeechRecognition(): boolean {
  return getSpeechRecognitionCtor() !== null
}

export function listenWithWebSpeech(
  onPartial: (text: string) => void,
  signal: AbortSignal,
): Promise<string> {
  const Ctor = getSpeechRecognitionCtor()
  if (!Ctor) {
    return Promise.reject(new Error('Web Speech recognition is not available'))
  }

  return new Promise((resolve, reject) => {
    const recognition = new Ctor()
    recognition.lang = navigator.language || 'en-US'
    recognition.continuous = false
    recognition.interimResults = true

    let finalText = ''

    const finish = (err?: Error) => {
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      try {
        recognition.abort()
      } catch {
        // ignore
      }
      if (err) reject(err)
      else resolve(finalText.trim())
    }

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        const chunk = result[0]?.transcript ?? ''
        if (result.isFinal) finalText += chunk
        else interim += chunk
      }
      onPartial((finalText + interim).trim())
    }

    recognition.onerror = (event) => {
      if (event.error === 'aborted') {
        finish(new Error('aborted'))
        return
      }
      finish(new Error(event.error || 'recognition_failed'))
    }

    recognition.onend = () => {
      finish()
    }

    signal.addEventListener(
      'abort',
      () => {
        try {
          recognition.abort()
        } catch {
          // ignore
        }
        finish(new Error('aborted'))
      },
      { once: true },
    )

    try {
      recognition.start()
    } catch (e) {
      finish(e instanceof Error ? e : new Error('recognition_start_failed'))
    }
  })
}

export function canUseWebSpeechSynthesis(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

let preferredVoice: SpeechSynthesisVoice | null = null

function pickVoice(): SpeechSynthesisVoice | null {
  if (preferredVoice) return preferredVoice
  const voices = window.speechSynthesis.getVoices()
  const english = voices.filter((v) => v.lang.startsWith('en'))
  preferredVoice =
    english.find((v) => /female|samantha|victoria|zira|karen|moira|fiona/i.test(v.name)) ??
    english[0] ??
    voices[0] ??
    null
  return preferredVoice
}

if (typeof window !== 'undefined' && canUseWebSpeechSynthesis()) {
  window.speechSynthesis.onvoiceschanged = () => {
    preferredVoice = null
  }
}

export function speakWithWebSpeech(text: string): {
  stop: () => void
  done: Promise<void>
} {
  if (!canUseWebSpeechSynthesis()) {
    return {
      stop: () => {},
      done: Promise.reject(new Error('speechSynthesis unavailable')),
    }
  }

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  const voice = pickVoice()
  if (voice) utterance.voice = voice
  utterance.rate = 1
  utterance.pitch = 1

  let resolveDone!: () => void
  let rejectDone!: (err: Error) => void
  const done = new Promise<void>((resolve, reject) => {
    resolveDone = resolve
    rejectDone = reject
  })

  utterance.onend = () => resolveDone()
  utterance.onerror = () => rejectDone(new Error('speech_synthesis_error'))

  window.speechSynthesis.speak(utterance)

  return {
    stop: () => {
      window.speechSynthesis.cancel()
      resolveDone()
    },
    done,
  }
}

export function stopWebSpeech(): void {
  if (canUseWebSpeechSynthesis()) {
    window.speechSynthesis.cancel()
  }
}
