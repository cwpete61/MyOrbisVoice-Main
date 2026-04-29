// Billing page browser tests
import { newPage, runTest, printResults } from '../harness.js'
import { BASE_URL, API_URL } from '../config.js'

async function signupAndGetToken(email: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Test1234!', businessName: 'Billing Browser Test' }),
  })
  const body = await res.json() as { data?: { accessToken?: string } }
  const token = body.data?.accessToken
  if (!token) throw new Error('No access token from signup')
  return token
}

export async function runBillingSuite() {
  const results = []
  const email = `e2e-billing-${Date.now()}@test.local`
  const token = await signupAndGetToken(email)

  results.push(await runTest('Billing page loads with authentication', async () => {
    const page = await newPage()
    try {
      await page.goto(`${BASE_URL}/login`)
      await page.evaluate((t: string) => localStorage.setItem('va_access_token', t), token)

      await page.goto(`${BASE_URL}/billing`)
      await page.waitForSelector('h1', { timeout: 10_000 })

      const h1 = await page.$eval('h1', (el) => el.textContent)
      if (!h1?.toLowerCase().includes('billing')) throw new Error(`Expected Billing heading, got: ${h1}`)
    } finally {
      await page.close()
    }
  }))

  results.push(await runTest('Billing page shows 3 plan cards', async () => {
    const page = await newPage()
    try {
      await page.goto(`${BASE_URL}/login`)
      await page.evaluate((t: string) => localStorage.setItem('va_access_token', t), token)
      await page.goto(`${BASE_URL}/billing`)
      await page.waitForSelector('h1', { timeout: 10_000 })

      // Wait for plans to load
      await page.waitForFunction(
        () => document.querySelectorAll('button').length > 0,
        { timeout: 10_000 },
      )

      const bodyText = await page.evaluate(() => document.body.innerText)
      const hasStarter = bodyText.toLowerCase().includes('starter')
      const hasPro = bodyText.toLowerCase().includes('pro')
      const hasEnterprise = bodyText.toLowerCase().includes('enterprise')
      if (!hasStarter) throw new Error('Missing Starter plan')
      if (!hasPro) throw new Error('Missing Pro plan')
      if (!hasEnterprise) throw new Error('Missing Enterprise plan')
    } finally {
      await page.close()
    }
  }))

  results.push(await runTest('Billing page shows entitlement breakdown', async () => {
    const page = await newPage()
    try {
      await page.goto(`${BASE_URL}/login`)
      await page.evaluate((t: string) => localStorage.setItem('va_access_token', t), token)
      await page.goto(`${BASE_URL}/billing`)
      await page.waitForSelector('h1', { timeout: 10_000 })
      await new Promise(r => setTimeout(r, 2000))

      const bodyText = await page.evaluate(() => document.body.innerText)
      const hasEntitlement = bodyText.includes('channel') || bodyText.includes('minutes') || bodyText.includes('widget')
      if (!hasEntitlement) throw new Error('No entitlement data visible on billing page')
    } finally {
      await page.close()
    }
  }))

  results.push(await runTest('Billing sidebar link is present', async () => {
    const page = await newPage()
    try {
      await page.goto(`${BASE_URL}/login`)
      await page.evaluate((t: string) => localStorage.setItem('va_access_token', t), token)
      await page.goto(`${BASE_URL}/dashboard`)
      await page.waitForSelector('nav', { timeout: 10_000 })

      const links = await page.$$eval('a', (els) => els.map((el) => el.href + '|' + el.textContent))
      const hasBillingLink = links.some((l) => l.toLowerCase().includes('billing'))
      if (!hasBillingLink) throw new Error('No billing link in navigation')
    } finally {
      await page.close()
    }
  }))

  results.push(await runTest('Select plan button visible (Coming soon without Stripe price)', async () => {
    const page = await newPage()
    try {
      await page.goto(`${BASE_URL}/login`)
      await page.evaluate((t: string) => localStorage.setItem('va_access_token', t), token)
      await page.goto(`${BASE_URL}/billing`)
      await page.waitForSelector('h1', { timeout: 10_000 })
      await new Promise(r => setTimeout(r, 2000))

      const buttons = await page.$$eval('button', (els) => els.map((el) => el.textContent?.trim()))
      const hasAction = buttons.some((b) =>
        b?.toLowerCase().includes('select') ||
        b?.toLowerCase().includes('coming') ||
        b?.toLowerCase().includes('current'),
      )
      if (!hasAction) throw new Error(`No plan action buttons found. Buttons: ${JSON.stringify(buttons)}`)
    } finally {
      await page.close()
    }
  }))

  printResults(results, 'Billing (Browser)')
  return results
}
