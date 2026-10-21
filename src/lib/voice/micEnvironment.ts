export type MicBlockReason = 'insecure' | 'unsupported' | 'denied'

export function isSecureMicContext(): boolean {
  if (typeof window === 'undefined') return false
  return window.isSecureContext
}

export function getMediaRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  return candidates.find((t) => MediaRecorder.isTypeSupported(t))
}

export function canUseMediaRecorder(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    getMediaRecorderMimeType() !== undefined
  )
}

export async function probeMicPermission(): Promise<MicBlockReason | null> {
  if (!isSecureMicContext()) return 'insecure'
  if (!canUseMediaRecorder()) return 'unsupported'

  if (navigator.permissions?.query) {
    try {
      const status = await navigator.permissions.query({
        name: 'microphone' as PermissionName,
      })
      if (status.state === 'denied') return 'denied'
    } catch {
      // Permissions API may not support microphone on all browsers
    }
  }

  return null
}

export function micBlockMessage(reason: MicBlockReason): string {
  switch (reason) {
    case 'insecure':
      return 'Microphone requires HTTPS (or localhost). Enable VITE_DEV_HTTPS=true for LAN access.'
    case 'unsupported':
      return 'Voice input is not supported in this browser.'
    case 'denied':
      return 'Microphone access was denied. Allow mic permission in browser settings.'
  }
}
