// Browser-based auth flow tests
//
// Selectors target attributes that are robust to layout changes — autocomplete,
// placeholder hints, and HTML5 input types. Avoid brittle CSS classes /
// element nth-child paths.
//
// The /login page uses input[type="text"] for the username/email field
// (because it accepts EITHER username OR email) and input[type="password"]
// for password. The /signup page has 4 inputs: username, business name,
// email (type=email), password.

import { newPage, newIncognitoPage, runTest, printResults } from '../harness.js'
import { BASE_URL, TEST_USER } from '../config.js'

const USERNAME_OR_EMAIL_SEL = 'input[autocomplete="username"]'
const PASSWORD_SEL          = 'input[type="password"]'
const EMAIL_SIGNUP_SEL      = 'input[type="email"]'
const BUSINESS_NAME_SEL     = 'input[placeholder*="Acme" i], input[placeholder*="business" i]'

export async function runAuthSuite() {
  const results = []

  // Use the disposable test domain — the admin /test-tenants cleanup endpoint
  // wipes anything ending @orbisvoice.test, so these don't accumulate.
  const email    = `e2e-auth-${Date.now()}@orbisvoice.test`
  const username = `e2eauth${Date.now().toString(36)}`

  results.push(await runTest('Signup page loads', async () => {
    const page = await newPage()
    try {
      await page.goto(`${BASE_URL}/signup`)
      await page.waitForSelector(EMAIL_SIGNUP_SEL, { timeout: 10_000 })
      const title = await page.title()
      if (!title) throw new Error('No page title')
    } finally {
      await page.close()
    }
  }))

  results.push(await runTest('Signup with new account → redirects away from /signup', async () => {
    const page = await newPage()
    try {
      await page.goto(`${BASE_URL}/signup`)
      await page.waitForSelector(EMAIL_SIGNUP_SEL)

      const usernameEl = await page.$(USERNAME_OR_EMAIL_SEL)
      const bizEl      = await page.$(BUSINESS_NAME_SEL)
      if (!usernameEl || !bizEl) throw new Error(`could not find required inputs (username=${!!usernameEl} biz=${!!bizEl})`)

      await usernameEl.type(username)
      await bizEl.type(TEST_USER.businessName)
      await page.type(EMAIL_SIGNUP_SEL, email)
      await page.type(PASSWORD_SEL, TEST_USER.password)

      const [response] = await Promise.all([
        page.waitForResponse(r => r.url().includes('/api/auth/signup') && r.request().method() === 'POST', { timeout: 20_000 }),
        page.click('button[type="submit"]'),
      ])
      if (response.status() !== 201 && response.status() !== 200) {
        throw new Error(`signup API returned ${response.status()}`)
      }

      await page.waitForFunction(() => !window.location.pathname.includes('/signup'), { timeout: 15_000 })
      const url = page.url()
      if (url.includes('/signup')) throw new Error(`Expected redirect away from /signup, still at ${url}`)
    } finally {
      await page.close()
    }
  }))

  results.push(await runTest('Login page loads', async () => {
    const page = await newPage()
    try {
      await page.goto(`${BASE_URL}/login`)
      // Login page uses input[type=text] (accepts username OR email), find by autocomplete
      await page.waitForSelector(USERNAME_OR_EMAIL_SEL, { timeout: 10_000 })
      await page.waitForSelector(PASSWORD_SEL, { timeout: 10_000 })
    } finally {
      await page.close()
    }
  }))

  results.push(await runTest('Login with valid credentials → authenticated', async () => {
    const page = await newPage()
    try {
      await page.goto(`${BASE_URL}/login`)
      await page.waitForSelector(USERNAME_OR_EMAIL_SEL)

      // Login accepts either username or email — use the email we just signed up with
      await page.type(USERNAME_OR_EMAIL_SEL, email)
      await page.type(PASSWORD_SEL, TEST_USER.password)
      await page.click('button[type="submit"]')

      // 30s timeout — every route is now ƒ (server-rendered on demand) since
      // the locale-detect change in the root layout, so first paint of the
      // dashboard target after login can be slower than the 15s default.
      await page.waitForFunction(() => !window.location.pathname.includes('/login'), { timeout: 30_000 })
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
      await page.waitForSelector(USERNAME_OR_EMAIL_SEL)

      await page.type(USERNAME_OR_EMAIL_SEL, email)
      await page.type(PASSWORD_SEL, 'WrongPassword!')
      await page.click('button[type="submit"]')

      // Either an error toast appears OR we stay on /login. Wait up to 5s for either.
      await new Promise(r => setTimeout(r, 2500))
      const url = page.url()
      const bodyText = await page.evaluate(() => document.body.innerText)
      const onLogin   = url.includes('/login')
      const showsError = /invalid|incorrect|wrong|error/i.test(bodyText)
      if (!onLogin && !showsError) throw new Error('Wrong password did not produce an error or stay on login')
    } finally {
      await page.close()
    }
  }))

  results.push(await runTest('Unauthenticated access to /settings → redirects to login', async () => {
    const { page, context } = await newIncognitoPage()
    try {
      await page.goto(`${BASE_URL}/settings`)
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
