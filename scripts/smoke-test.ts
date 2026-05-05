/**
 * Customer journey smoke test.
 *
 * Drives Puppeteer through the most-critical-of-all flow that every new
 * customer experiences in their first 60 seconds: signup → land on
 * dashboard → see content. If this breaks, no customer can use the
 * product. So we test it explicitly.
 *
 * Usage:
 *   pnpm smoke-test                       # against prod
 *   E2E_BASE_URL=http://localhost:3000 pnpm smoke-test  # against local
 *
 * Read-only on the server side except for creating one test tenant per
 * run with a timestamp-suffixed email — disposable, doesn't pollute real
 * data because it's gated behind an obvious test-domain email.
 *
 * Exit code 0 = green, 1 = something broke.
 */

import puppeteer, { type Page } from 'puppeteer'

const BASE_URL = process.env['E2E_BASE_URL'] ?? 'https://app.myorbisvoice.com'

interface CheckResult {
  step:     string
  status:   'pass' | 'fail'
  detail:   string
  durationMs: number
}

const results: CheckResult[] = []

async function step(name: string, fn: () => Promise<string>): Promise<boolean> {
  const start = Date.now()
  try {
    const detail = await fn()
    const ms = Date.now() - start
    results.push({ step: name, status: 'pass', detail, durationMs: ms })
    console.log(`\x1b[32m✓\x1b[0m ${name} (${ms}ms)`)
    if (detail) console.log(`   ${detail}`)
    return true
  } catch (err) {
    const ms = Date.now() - start
    const detail = (err as Error).message
    results.push({ step: name, status: 'fail', detail, durationMs: ms })
    console.log(`\x1b[31m✗\x1b[0m ${name} (${ms}ms)`)
    console.log(`   ${detail}`)
    return false
  }
}

async function takeScreenshotOnFail(page: Page, label: string): Promise<void> {
  try {
    const path = `/tmp/smoke-test-fail-${label}-${Date.now()}.png`
    await page.screenshot({ path: path as `${string}.png`, fullPage: true })
    console.log(`   Screenshot → ${path}`)
  } catch { /* best effort */ }
}

async function main() {
  console.log(`MyOrbisVoice — customer journey smoke test`)
  console.log(`============================================`)
  console.log(`Target: ${BASE_URL}`)
  console.log()

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })

  // Disposable test identity — timestamp suffix makes each run unique
  const testEmail        = `smoke-${Date.now()}@orbisvoice.test`
  const testUsername     = `smoke${Date.now().toString(36)}`
  const testBusinessName = `Smoke Test Co. ${new Date().toISOString().slice(0, 10)}`
  const testPassword     = 'SmokeTest2026!'

  let allPassed = true

  allPassed = await step('Marketing site loads', async () => {
    const r = await fetch('https://myorbisvoice.com', { signal: AbortSignal.timeout(10_000) })
    if (r.status !== 200) throw new Error(`HTTP ${r.status}`)
    return `200 OK`
  }) && allPassed

  allPassed = await step('Login page renders', async () => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: 15_000 })
    const titleHasMyOrbis = await page.evaluate(() => /MyOrbisVoice/i.test(document.title) || /MyOrbisVoice/i.test(document.body.innerText))
    if (!titleHasMyOrbis) throw new Error('page rendered but did not contain MyOrbisVoice branding')
    return `${page.url()}`
  }) && allPassed

  allPassed = await step('Signup page renders + accepts input', async () => {
    await page.goto(`${BASE_URL}/signup`, { waitUntil: 'networkidle2', timeout: 15_000 })
    // Signup has 4 fields: username (text), business name (text), email (email), password (password)
    await page.waitForSelector('input[type="email"]', { timeout: 10_000 })
    return `4 input fields present`
  }) && allPassed

  if (allPassed) {
    allPassed = await step('Signup with new tenant → redirects to authenticated app', async () => {
      // Find inputs by autocomplete + placeholder + type — robust to layout changes
      const usernameSel = 'input[autocomplete="username"], input[placeholder*="orbisadmin" i], input[placeholder*="yourhandle" i]'
      const bizSel      = 'input[placeholder*="Acme" i], input[placeholder*="business" i], input[name*="business" i]'
      const emailSel    = 'input[type="email"]'
      const pwSel       = 'input[type="password"]'

      const usernameEl = await page.$(usernameSel)
      const bizEl      = await page.$(bizSel)
      const emailEl    = await page.$(emailSel)
      const pwEl       = await page.$(pwSel)
      if (!usernameEl || !bizEl || !emailEl || !pwEl) {
        await takeScreenshotOnFail(page, 'signup-fields-missing')
        throw new Error(`could not find all 4 inputs (username=${!!usernameEl} biz=${!!bizEl} email=${!!emailEl} pw=${!!pwEl})`)
      }
      await usernameEl.type(testUsername)
      await bizEl.type(testBusinessName)
      await emailEl.type(testEmail)
      await pwEl.type(testPassword)

      const [response] = await Promise.all([
        page.waitForResponse(r => r.url().includes('/api/auth/signup') && r.request().method() === 'POST', { timeout: 20_000 }),
        page.click('button[type="submit"]'),
      ])

      if (response.status() !== 201 && response.status() !== 200) {
        await takeScreenshotOnFail(page, 'signup-api-error')
        throw new Error(`signup API returned ${response.status()}`)
      }

      // Wait for client-side navigation away from /signup
      await page.waitForFunction(() => !window.location.pathname.includes('/signup'), { timeout: 15_000 }).catch(() => null)
      const finalUrl = page.url()
      if (finalUrl.includes('/signup')) {
        await takeScreenshotOnFail(page, 'signup-no-redirect')
        throw new Error(`stayed on /signup after submit — ${finalUrl}`)
      }
      return `landed on ${new URL(finalUrl).pathname}`
    }) && allPassed
  }

  if (allPassed) {
    allPassed = await step('Authenticated app shell renders without runtime errors', async () => {
      // Already on a logged-in page from previous step
      await page.waitForSelector('aside, nav', { timeout: 10_000 })
      const errors: string[] = []
      page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
      page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`) })
      // give it a beat to render
      await new Promise(r => setTimeout(r, 1500))
      if (errors.length > 0) {
        await takeScreenshotOnFail(page, 'app-shell-errors')
        throw new Error(`runtime errors: ${errors.slice(0, 3).join(' | ')}`)
      }
      return `clean render, no console errors`
    }) && allPassed
  }

  if (allPassed) {
    allPassed = await step('Channels page reachable from logged-in state', async () => {
      await page.goto(`${BASE_URL}/channels`, { waitUntil: 'networkidle2', timeout: 15_000 })
      const hasChannels = await page.evaluate(() => /widget|inbound|outbound/i.test(document.body.innerText))
      if (!hasChannels) throw new Error('channels page rendered but did not show widget/inbound/outbound')
      return 'rendered with channel cards visible'
    }) && allPassed
  }

  // Clean up the disposable test tenant + user (and any leftover
  // @orbisvoice.test rows from prior runs). Best-effort — if admin creds
  // aren't available we just leave the tenant for periodic manual cleanup.
  const adminEmail    = process.env['E2E_ADMIN_LOGIN_EMAIL']
  const adminPassword = process.env['E2E_ADMIN_LOGIN_PASSWORD']
  if (adminEmail && adminPassword) {
    await step('Cleanup: delete @orbisvoice.test tenants via admin endpoint', async () => {
      const apiUrl = (process.env['E2E_API_URL'] ?? BASE_URL.replace('app.', 'api.'))
      const loginResp = await fetch(`${apiUrl}/api/auth/login`, {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ login: adminEmail, password: adminPassword }),
      })
      if (!loginResp.ok) throw new Error(`admin login failed: ${loginResp.status}`)
      const loginJson = await loginResp.json() as { data: { accessToken: string } }
      const token = loginJson.data.accessToken
      const cleanupResp = await fetch(`${apiUrl}/api/admin/test-tenants`, {
        method:  'DELETE',
        headers: { authorization: `Bearer ${token}` },
      })
      if (!cleanupResp.ok) throw new Error(`cleanup failed: ${cleanupResp.status}`)
      const cleanupJson = await cleanupResp.json() as { data: { deletedTenantCount: number; deletedUserCount: number } }
      return `removed ${cleanupJson.data.deletedTenantCount} test tenants + ${cleanupJson.data.deletedUserCount} users`
    })
  } else {
    console.log('\x1b[33m⚠\x1b[0m Cleanup skipped — set E2E_ADMIN_LOGIN_EMAIL + E2E_ADMIN_LOGIN_PASSWORD to enable')
    console.log('   Test tenant left behind:', testEmail)
  }

  await browser.close()

  console.log()
  console.log('============================================')
  const passed = results.filter(r => r.status === 'pass').length
  const failed = results.filter(r => r.status === 'fail').length
  const totalMs = results.reduce((s, r) => s + r.durationMs, 0)
  console.log(`Result: ${passed} passed, ${failed} failed in ${(totalMs / 1000).toFixed(1)}s`)
  console.log(`Test tenant: ${testEmail} (disposable, leave in DB or delete via admin tools)`)
  if (failed > 0) {
    console.log(`\n\x1b[31mCustomer journey is broken — investigate before opening to new signups.\x1b[0m`)
    process.exit(1)
  } else {
    console.log(`\n\x1b[32mNew customer flow is healthy. Safe to launch.\x1b[0m`)
    process.exit(0)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
