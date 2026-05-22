#!/usr/bin/env node
/**
 * run-myorbisvoice driver — launches a headless Chromium against the local web
 * app, drives a real partner login, and screenshots key pages. Agent tooling:
 * gives a future agent a programmatic handle on the running UI.
 *
 * Playwright lives in apps/api's deps; resolve it from there so this script
 * works regardless of where it's invoked from.
 *
 *   node .claude/skills/run-myorbisvoice/driver.mjs            # login flow + screenshots
 *   node .claude/skills/run-myorbisvoice/driver.mjs <url>      # just screenshot a URL
 *
 * Env: WEB_URL (default http://localhost:3000),
 *      LOGIN_EMAIL / LOGIN_PASSWORD (default demo partner seeded by seed-demo.mjs)
 */
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, resolve, join } from 'path'
import { mkdirSync } from 'fs'

const here = dirname(fileURLToPath(import.meta.url))
const req = createRequire(resolve(here, '../../../apps/api/package.json'))
const { chromium } = req('playwright')

const WEB = process.env.WEB_URL || 'http://localhost:3000'
const EMAIL = process.env.LOGIN_EMAIL || 'gmb-demo@local.test'
const PW = process.env.LOGIN_PASSWORD || 'Demo1234!'
const OUT = '/tmp/run-myorbisvoice'
mkdirSync(OUT, { recursive: true })

const onlyUrl = process.argv[2]

async function shot(page, name) {
  const path = join(OUT, name)
  await page.screenshot({ path, fullPage: true })
  console.log('screenshot:', path)
}

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })

try {
  if (onlyUrl) {
    await page.goto(onlyUrl, { waitUntil: 'networkidle', timeout: 30000 })
    await shot(page, 'page.png')
    console.log('title:', await page.title())
  } else {
    // 1. Login page
    await page.goto(`${WEB}/partner-portal/login`, { waitUntil: 'networkidle', timeout: 30000 })
    await shot(page, '01-login.png')

    // 2. Fill + submit the login form
    await page.locator('input[type="email"], input[type="text"]').first().fill(EMAIL)
    await page.locator('input[type="password"]').first().fill(PW)
    await page.getByRole('button', { name: /sign in/i }).first().click()
      .catch(() => page.locator('button[type="submit"]').first().click())
    // Wait until we actually leave the login page (it lives under /partner-portal too).
    await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 20000 })
      .catch(() => console.log('  (no redirect — login may have failed)'))
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(1500)
    await shot(page, '02-after-login.png')
    console.log('after-login url:', page.url())

    // 3. The GBP Audit page (the feature surface)
    await page.goto(`${WEB}/partner-portal/gmb-evaluation`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(1500)
    await shot(page, '03-gbp-audit.png')

    // 4. Market Vault
    await page.goto(`${WEB}/partner-portal/market-vault`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(1500)
    await shot(page, '04-market-vault.png')
  }
} catch (err) {
  console.error('driver error:', err.message)
  await shot(page, 'error.png').catch(() => {})
  process.exitCode = 1
} finally {
  await browser.close()
}
