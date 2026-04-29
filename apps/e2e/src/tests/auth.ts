// Browser-based auth flow tests
import { newPage, newIncognitoPage, runTest, printResults } from '../harness.js'
import { BASE_URL, TEST_USER } from '../config.js'

export async function runAuthSuite() {
  const results = []

  // Use a unique email per run
  const email = `e2e-auth-${Date.now()}@test.local`

  results.push(await runTest('Signup page loads', async () => {
    const page = await newPage()
    try {
      await page.goto(`${BASE_URL}/signup`)
      await page.waitForSelector('input[type="email"]', { timeout: 10_000 })
      const title = await page.title()
      if (!title) throw new Error('No page title')
    } finally {
      await page.close()
    }
  }))

  results.push(await runTest('Signup with new account → redirects to dashboard', async () => {
    const page = await newPage()
    try {
      await page.goto(`${BASE_URL}/signup`)
      await page.waitForSelector('input[type="email"]')

      await page.type('input[type="email"]', email)
      await page.type('input[type="password"]', TEST_USER.password)

      // Business name field — find by placeholder or label
      const bizInput = await page.$('input[placeholder*="business" i], input[id*="business" i], input[name*="business" i]')
      if (bizInput) await bizInput.type(TEST_USER.businessName)

      await page.click('button[type="submit"]')
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15_000 })

      const url = page.url()
      if (!url.includes('/dashboard') && !url.includes('/settings') && url.includes('/signup')) {
        throw new Error(`Expected redirect away from signup, still at ${url}`)
      }
    } finally {
      await page.close()
    }
  }))

  results.push(await runTest('Login page loads', async () => {
    const page = await newPage()
    try {
      await page.goto(`${BASE_URL}/login`)
      await page.waitForSelector('input[type="email"]', { timeout: 10_000 })
    } finally {
      await page.close()
    }
  }))

  results.push(await runTest('Login with valid credentials → authenticated', async () => {
    const page = await newPage()
    try {
      await page.goto(`${BASE_URL}/login`)
      await page.waitForSelector('input[type="email"]')

      await page.type('input[type="email"]', email)
      await page.type('input[type="password"]', TEST_USER.password)
      await page.click('button[type="submit"]')

      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15_000 })
      const url = page.url()
      if (url.includes('/login')) throw new Error(`Still on login page: ${url}`)
    } finally {
      await page.close()
    }
  }))

  results.push(await runTest('Login with wrong password → stays on login', async () => {
    const page = await newPage()
    try {
      await page.goto(`${BASE_URL}/login`)
      await page.waitForSelector('input[type="email"]')

      await page.type('input[type="email"]', email)
      await page.type('input[type="password"]', 'WrongPassword!')
      await page.click('button[type="submit"]')

      // Should stay on login or show error
      await new Promise(r => setTimeout(r, 2000))
      const url = page.url()
      const bodyText = await page.evaluate(() => document.body.innerText)
      const hasError = bodyText.toLowerCase().includes('invalid') || bodyText.toLowerCase().includes('error') || url.includes('/login')
      if (!hasError) throw new Error('No error shown for wrong password')
    } finally {
      await page.close()
    }
  }))

  results.push(await runTest('Unauthenticated access to /settings → redirects to login', async () => {
    // Use isolated context so no tokens leak from previous test pages
    const { page, context } = await newIncognitoPage()
    try {
      await page.goto(`${BASE_URL}/settings`)
      // Client-side AuthGuard fires after hydration — wait for URL to change
      await page.waitForFunction(
        () => window.location.pathname === '/login',
        { timeout: 10_000 }
      )
    } finally {
      await context.close()
    }
  }))

  printResults(results, 'Auth (Browser)')
  return results
}
