/**
 * Browser check: stop during slow TTS loading prevents playback.
 * Run: node scripts/verify-voice-stop.mjs
 */
import { chromium } from 'playwright'

const base = process.env.HOLLY_URL || 'http://127.0.0.1:5199'

let delayMessages = false
let speechRequestSeen = false

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

page.on('request', (req) => {
  if (req.url().includes('/api/audio/speech') && req.method() === 'POST') {
    speechRequestSeen = true
  }
})

await page.route('**/api/audio/capabilities', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      serverAudio: true,
      sttModel: 'whisper-1',
      ttsModel: 'tts-1',
      ttsVoice: 'nova',
    }),
  })
})

await page.route('**/api/chat', async (route) => {
  if (route.request().method() !== 'POST') {
    await route.continue()
    return
  }
  const body =
    'data: {"type":"delta","text":"Hello, this is a voice stop test."}\n\n' +
    'data: {"type":"done"}\n\n'
  await route.fulfill({
    status: 200,
    contentType: 'text/event-stream',
    body,
  })
})

await page.route('**/messages', async (route) => {
  if (delayMessages) await new Promise((resolve) => setTimeout(resolve, 15_000))
  await route.continue()
})

await page.route('**/api/audio/speech', async (route) => {
  await new Promise((resolve) => setTimeout(resolve, 4000))
  await route.fulfill({
    status: 200,
    contentType: 'audio/mpeg',
    body: Buffer.from([0xff, 0xfb, 0x90, 0x00]),
  })
})

await page.goto(base, { waitUntil: 'domcontentloaded' })
await page.evaluate(() => localStorage.setItem('holly.speakReplies', '1'))
await page.reload({ waitUntil: 'domcontentloaded' })

delayMessages = true

const textarea = page.getByPlaceholder(/Share what/i)
await textarea.click()
await textarea.pressSequentially('voice stop test')
await textarea.press('Enter')

await page.getByText(/Preparing Holly/i).waitFor({ timeout: 15000 })

await page.getByRole('button', { name: 'Stop' }).first().click()
await page.getByText(/Preparing Holly|Holly is speaking/i).waitFor({ state: 'hidden', timeout: 8000 })

await page.waitForTimeout(4500)

const bannerVisible = await page
  .getByText(/Preparing Holly|Holly is speaking/i)
  .isVisible()
  .catch(() => false)

if (bannerVisible) {
  console.error('FAIL: voice banner still visible after Stop')
  process.exit(1)
}
if (!speechRequestSeen) {
  console.error('FAIL: never requested /api/audio/speech')
  process.exit(1)
}

console.log('PASS: stop during TTS loading hid UI before delayed audio completed')
await browser.close()
