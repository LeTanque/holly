import { useCallback, useEffect, useRef, useState } from 'react'

import { fetchAudioCapabilities, transcribeBlob } from './audioApi'
import {
  canUseMediaRecorder,
  getMediaRecorderMimeType,
  isSecureMicContext,
  micBlockMessage,
  probeMicPermission,
  type MicBlockReason,
} from './micEnvironment'
import { canUseWebSpeechRecognition, listenWithWebSpeech } from './webSpeech'

export type VoiceInputPhase = 'idle' | 'recording' | 'transcribing'

export type VoiceInputState = {
  phase: VoiceInputPhase
  blockReason: MicBlockReason | null
  error: string | null
  canUseMic: boolean
}

type Options = {
  onTranscript: (text: string) => void
  onPartialTranscript?: (text: string) => void
  onRecordingStart?: () => void
}

export function useVoiceInput({
  onTranscript,
  onPartialTranscript,
  onRecordingStart,
}: Options) {
  const [state, setState] = useState<VoiceInputState>({
    phase: 'idle',
    blockReason: null,
    error: null,
    canUseMic: isSecureMicContext() && (canUseMediaRecorder() || canUseWebSpeechRecognition()),
  })

  const mediaStreamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const sessionAbortRef = useRef<AbortController | null>(null)
  const webSpeechBackupRef = useRef<string>('')
  const mimeTypeRef = useRef<string>('audio/webm')

  useEffect(() => {
    void (async () => {
      const block = await probeMicPermission()
      setState((s) => ({
        ...s,
        blockReason: block,
        canUseMic:
          !block &&
          isSecureMicContext() &&
          (canUseMediaRecorder() || canUseWebSpeechRecognition()),
      }))
    })()
  }, [])

  const cleanupStream = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
    mediaStreamRef.current = null
    recorderRef.current = null
    chunksRef.current = []
    sessionAbortRef.current?.abort()
    sessionAbortRef.current = null
    webSpeechBackupRef.current = ''
  }, [])

  const finishWithError = useCallback(
    (message: string) => {
      cleanupStream()
      setState((s) => ({ ...s, phase: 'idle', error: message }))
    },
    [cleanupStream],
  )

  const deliverTranscript = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) {
        finishWithError('No speech detected')
        return
      }
      onTranscript(trimmed)
      setState((s) => ({ ...s, phase: 'idle', error: null }))
      cleanupStream()
    },
    [cleanupStream, finishWithError, onTranscript],
  )

  const transcribeRecording = useCallback(
    async (blob: Blob, mimeType: string) => {
      setState((s) => ({ ...s, phase: 'transcribing', error: null }))
      const caps = await fetchAudioCapabilities()
      const backup = webSpeechBackupRef.current.trim()

      if (caps.serverAudio) {
        try {
          const text = await transcribeBlob(blob, mimeType)
          deliverTranscript(text)
          return
        } catch {
          if (backup) {
            deliverTranscript(backup)
            return
          }
          if (canUseWebSpeechRecognition()) {
            finishWithError('Server transcription failed. Speak again to use browser recognition.')
            return
          }
          finishWithError('Transcription failed')
          return
        }
      }

      if (backup) {
        deliverTranscript(backup)
        return
      }

      finishWithError('No transcription service available')
    },
    [deliverTranscript, finishWithError],
  )

  const startWebSpeechBackup = useCallback(() => {
    if (!canUseWebSpeechRecognition()) return
    const controller = new AbortController()
    sessionAbortRef.current = controller
    webSpeechBackupRef.current = ''
    void listenWithWebSpeech(
      (partial) => {
        webSpeechBackupRef.current = partial
        onPartialTranscript?.(partial)
      },
      controller.signal,
    ).then((final) => {
      if (final) webSpeechBackupRef.current = final
    }).catch(() => {
      // aborted or failed — backup may still have partial text
    })
  }, [onPartialTranscript])

  const startMediaRecording = useCallback(async (withWebSpeechBackup: boolean) => {
    const mimeType = getMediaRecorderMimeType()
    if (!mimeType) {
      finishWithError(micBlockMessage('unsupported'))
      return
    }
    mimeTypeRef.current = mimeType

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      const recorder = new MediaRecorder(stream, { mimeType })
      recorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data)
      }

      recorder.onstop = () => {
        sessionAbortRef.current?.abort()
        const blob = new Blob(chunksRef.current, { type: mimeType })
        if (blob.size === 0) {
          const backup = webSpeechBackupRef.current.trim()
          if (backup) {
            deliverTranscript(backup)
            return
          }
          finishWithError('No audio captured')
          return
        }
        void transcribeRecording(blob, mimeType)
      }

      if (withWebSpeechBackup) startWebSpeechBackup()
      recorder.start()
      setState((s) => ({ ...s, phase: 'recording', error: null, blockReason: null }))
    } catch (e) {
      const name = e instanceof DOMException ? e.name : ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setState((s) => ({
          ...s,
          phase: 'idle',
          blockReason: 'denied',
          error: micBlockMessage('denied'),
        }))
      } else {
        finishWithError(e instanceof Error ? e.message : 'Could not start microphone')
      }
      cleanupStream()
    }
  }, [
    cleanupStream,
    deliverTranscript,
    finishWithError,
    startWebSpeechBackup,
    transcribeRecording,
  ])

  const startWebSpeechOnly = useCallback(async () => {
    sessionAbortRef.current = new AbortController()
    setState((s) => ({ ...s, phase: 'recording', error: null }))
    try {
      const text = await listenWithWebSpeech((partial) => {
        onPartialTranscript?.(partial)
      }, sessionAbortRef.current.signal)
      deliverTranscript(text)
    } catch (e) {
      if (e instanceof Error && e.message === 'aborted') {
        setState((s) => ({ ...s, phase: 'idle', error: null }))
        cleanupStream()
      } else {
        finishWithError(e instanceof Error ? e.message : 'Recognition failed')
      }
    }
  }, [cleanupStream, deliverTranscript, finishWithError, onPartialTranscript])

  const startRecording = useCallback(async () => {
    if (state.phase !== 'idle') return

    onRecordingStart?.()

    if (!isSecureMicContext()) {
      setState((s) => ({
        ...s,
        blockReason: 'insecure',
        error: micBlockMessage('insecure'),
      }))
      return
    }

    const block = state.blockReason ?? (await probeMicPermission())
    if (block) {
      setState((s) => ({
        ...s,
        blockReason: block,
        error: micBlockMessage(block),
      }))
      return
    }

    const caps = await fetchAudioCapabilities()
    if (caps.serverAudio && canUseMediaRecorder()) {
      await startMediaRecording(canUseWebSpeechRecognition())
      return
    }
    if (canUseWebSpeechRecognition()) {
      await startWebSpeechOnly()
      return
    }
    finishWithError(micBlockMessage('unsupported'))
  }, [
    finishWithError,
    onRecordingStart,
    startMediaRecording,
    startWebSpeechOnly,
    state.blockReason,
    state.phase,
  ])

  const stopRecording = useCallback(() => {
    if (state.phase !== 'recording') return
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
      return
    }
    sessionAbortRef.current?.abort()
    cleanupStream()
    setState((s) => ({ ...s, phase: 'idle' }))
  }, [cleanupStream, state.phase])

  const cancelRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.onstop = () => {
        cleanupStream()
        setState((s) => ({ ...s, phase: 'idle', error: null }))
      }
      recorderRef.current.stop()
      return
    }
    sessionAbortRef.current?.abort()
    cleanupStream()
    setState((s) => ({ ...s, phase: 'idle', error: null }))
  }, [cleanupStream])

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }))
  }, [])

  useEffect(() => () => cleanupStream(), [cleanupStream])

  return {
    state,
    startRecording,
    stopRecording,
    cancelRecording,
    clearError,
  }
}
