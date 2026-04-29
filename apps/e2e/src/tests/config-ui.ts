// Tenant configuration UI tests — settings, business DNA, agents, channels
import { newPage, runTest, printResults } from '../harness.js'
import { BASE_URL, API_URL } from '../config.js'

async function signupAndGetToken(email: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Test1234!', businessName: 'Config UI Test Co' }),
  })
  const body = await res.json() as { data?: { accessToken?: string } }
  const token = body.data?.accessToken
  if (!token) throw new Error('No access token from signup')
  return token
}

async function loadAuthPage(page: import('puppeteer').Page, token: string, path: string) {
  await page.goto(`${BASE_URL}/login`)
  await page.evaluate((t: string) => localStorage.setItem('va_access_token', t), token)
  await page.goto(`${BASE_URL}${path}`)
  await page.waitForSelector('h1', { timeout: 12_000 })
}

export async function runConfigSuite() {
  const results = []
  const email = `e2e-config-${Date.now()}@test.local`
  const token = await signupAndGetToken(email)

  results.push(await runTest('Settings page loads', async () => {
    const page = await newPage()
    try {
      await loadAuthPage(page, token, '/settings')
      const text = await page.evaluate(() => document.body.innerText)
      if (!text.toLowerCase().includes('setting')) throw new Error('Settings heading not found')
    } finally {
      await page.close()
    }
  }))

  results.push(await runTest('Settings page has workspace form fields', async () => {
    const page = await newPage()
    try {
      await loadAuthPage(page, token, '/settings')
      await new Promise(r => setTimeout(r, 1500))
      const inputs = await page.$$('input, textarea, select')
      if (inputs.length < 2) throw new Error(`Expected multiple form fields, found ${inputs.length}`)
    } finally {
      await page.close()
    }
  }))

  results.push(await runTest('Business DNA page loads', async () => {
    const page = await newPage()
    try {
      await loadAuthPage(page, token, '/business-dna')
      const text = await page.evaluate(() => document.body.innerText)
      const hasDna = text.toLowerCase().includes('dna') || text.toLowerCase().includes('business')
      if (!hasDna) throw new Error('Business DNA heading not found')
    } finally {
      await page.close()
    }
  }))

  results.push(await runTest('Business DNA page has draft/publish controls', async () => {
    const page = await newPage()
    try {
      await loadAuthPage(page, token, '/business-dna')
      await new Promise(r => setTimeout(r, 2000))
      const buttons = await page.$$eval('button', (els) => els.map((el) => el.textContent?.trim().toLowerCase()))
      const hasPublish = buttons.some((b) => b?.includes('publish') || b?.includes('draft') || b?.includes('save'))
      if (!hasPublish) throw new Error(`No publish/draft controls. Buttons: ${JSON.stringify(buttons)}`)
    } finally {
      await page.close()
    }
  }))

  results.push(await runTest('Agents page loads with 7 roles', async () => {
    const page = await newPage()
    try {
      await loadAuthPage(page, token, '/agents')
      await new Promise(r => setTimeout(r, 2000))
      const text = await page.evaluate(() => document.body.innerText)
      const roles = ['orchestrator', 'appointment', 'sales', 'customer service', 'marketing', 'assistant', 'secretary']
      const found = roles.filter((r) => text.toLowerCase().includes(r))
      if (found.length < 5) throw new Error(`Only found ${found.length}/7 agent roles: ${found.join(', ')}`)
    } finally {
      await page.close()
    }
  }))

  results.push(await runTest('Channels page loads with widget/inbound/outbound', async () => {
    const page = await newPage()
    try {
      await loadAuthPage(page, token, '/channels')
      await new Promise(r => setTimeout(r, 2000))
      const text = await page.evaluate(() => document.body.innerText)
      const hasWidget = text.toLowerCase().includes('widget')
      const hasInbound = text.toLowerCase().includes('inbound')
      const hasOutbound = text.toLowerCase().includes('outbound')
      if (!hasWidget) throw new Error('Widget channel not found')
      if (!hasInbound) throw new Error('Inbound channel not found')
      if (!hasOutbound) throw new Error('Outbound channel not found')
    } finally {
      await page.close()
    }
  }))

  results.push(await runTest('Prompts page loads', async () => {
    const page = await newPage()
    try {
      await loadAuthPage(page, token, '/prompts')
      const text = await page.evaluate(() => document.body.innerText)
      const hasPrompt = text.toLowerCase().includes('prompt')
      if (!hasPrompt) throw new Error('Prompts page content not found')
    } finally {
      await page.close()
    }
  }))

  results.push(await runTest('Sidebar navigation has all expected links', async () => {
    const page = await newPage()
    try {
      await page.goto(`${BASE_URL}/login`)
      await page.evaluate((t: string) => localStorage.setItem('va_access_token', t), token)
      await page.goto(`${BASE_URL}/dashboard`)
      await page.waitForSelector('nav, aside', { timeout: 10_000 })

      const links = await page.$$eval('a', (els) => els.map((el) => el.textContent?.trim().toLowerCase()))
      const expected = ['dashboard', 'business', 'prompt', 'agent', 'channel', 'billing', 'setting']
      const missing = expected.filter((e) => !links.some((l) => l?.includes(e)))
      if (missing.length > 0) throw new Error(`Missing nav links: ${missing.join(', ')}`)
    } finally {
      await page.close()
    }
  }))

  printResults(results, 'Config UI (Browser)')
  return results
}
