/** Strip markdown-ish formatting for text-to-speech. */
export function plainTextForSpeech(markdown: string): string {
  let text = markdown
  text = text.replace(/```[\s\S]*?```/g, ' ')
  text = text.replace(/`([^`]+)`/g, '$1')
  text = text.replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
  text = text.replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
  text = text.replace(/^#{1,6}\s+/gm, '')
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2')
  text = text.replace(/(\*|_)(.*?)\1/g, '$2')
  text = text.replace(/^>\s+/gm, '')
  text = text.replace(/^[-*+]\s+/gm, '')
  text = text.replace(/\s+/g, ' ')
  return text.trim()
}
