const SPEAK_KEY = 'holly.speakReplies'
const AUTO_SEND_KEY = 'holly.autoSendAfterVoice'

function readBool(key: string, defaultValue: boolean): boolean {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return defaultValue
    return raw === '1' || raw === 'true'
  } catch {
    return defaultValue
  }
}

function writeBool(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // ignore quota / private mode
  }
}

export function getSpeakRepliesEnabled(): boolean {
  return readBool(SPEAK_KEY, false)
}

export function setSpeakRepliesEnabled(enabled: boolean): void {
  writeBool(SPEAK_KEY, enabled)
}

export function getAutoSendAfterVoice(): boolean {
  return readBool(AUTO_SEND_KEY, false)
}

export function setAutoSendAfterVoice(enabled: boolean): void {
  writeBool(AUTO_SEND_KEY, enabled)
}
