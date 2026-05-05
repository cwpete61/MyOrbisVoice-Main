/**
 * Help-center screenshot capture.
 *
 * Reads helpContent.ts and adminHelpContent.ts, finds every screenshot slot
 * with a `capture` block, drives Puppeteer through the setup steps, and
 * writes the PNG to apps/web/public/help-screenshots/<filename> (or
 * /admin-help-screenshots/<filename>).
 *
 * Usage (from repo root):
 *   pnpm capture-screenshots                      # all annotated slots
 *   pnpm capture-screenshots --tenant             # only /help slots
 *   pnpm capture-screenshots --admin              # only /admin/help slots
 *   pnpm capture-screenshots --filename foo.png   # one slot by filename
 *
 * Required env vars:
 *   APP_BASE_URL              (default https://app.myorbisvoice.com)
 *   E2E_TENANT_LOGIN_EMAIL    (login for authAs:'tenant' captures)
 *   E2E_TENANT_LOGIN_PASSWORD
 *   E2E_ADMIN_LOGIN_EMAIL     (login for authAs:'admin' captures)
 *   E2E_ADMIN_LOGIN_PASSWORD
 *
 * Status: framework. Demonstrates the workflow end-to-end against any slot
 * that has `capture` metadata. Bulk annotation of the ~80 existing screenshot
 * slots is incremental editorial work — annotate as feature-testing surfaces
 * UI bugs and the captured screenshots become useful.
 */

import { mkdirSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer, { type Browser, type Page } from 'puppeteer'
import { HELP_CONTENT } from '../apps/web/src/lib/helpContent.js'
import { ADMIN_HELP_CONTENT } from '../apps/web/src/lib/adminHelpContent.js'
import type { ScreenshotCapture } from '../apps/web/src/lib/helpContent.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')

const APP_BASE_URL    = process.env['APP_BASE_URL']    ?? 'https://app.myorbisvoice.com'
const TENANT_EMAIL    = process.env['E2E_TENANT_LOGIN_EMAIL']
const TENANT_PASSWORD = process.env['E2E_TENANT_LOGIN_PASSWORD']
const ADMIN_EMAIL     = process.env['E2E_ADMIN_LOGIN_EMAIL']
const ADMIN_PASSWORD  = process.env['E2E_ADMIN_LOGIN_PASSWORD']

interface CaptureJob {
  filename: string
  caption:  string
  capture:  ScreenshotCapture
  outDir:   string
}

function collectJobs(args: { which: 'all' | 'tenant' | 'admin'; filename?: string }): CaptureJob[] {
  const jobs: CaptureJob[] = []
  const tenantOut = join(REPO_ROOT, 'apps/web/public/help-screenshots')
  const adminOut  = join(REPO_ROOT, 'apps/web/public/admin-help-screenshots')

  function walk(articles: typeof HELP_CONTENT, outDir: string) {
    for (const section of articles) {
      for (const article of section.articles) {
        for (const step of article.steps) {
          if (!step.screenshots) continue
          for (const shot of step.screenshots) {
            if (!shot.capture) continue
            if (args.filename && shot.filename !== args.filename) continue
            jobs.push({ filename: shot.filename, caption: shot.caption, capture: shot.capture, outDir })
          }
        }
      }
    }
  }

  if (args.which !== 'admin') walk(HELP_CONTENT as never, tenantOut)
  if (args.which !== 'tenant') walk(ADMIN_HELP_CONTENT as never, adminOut)
  return jobs
}

async function login(page: Page, role: 'tenant' | 'admin'): Promise<void> {
  const email    = role === 'admin' ? ADMIN_EMAIL    : TENANT_EMAIL
  const password = role === 'admin' ? ADMIN_PASSWORD : TENANT_PASSWORD
  if (!email || !password) {
    throw new Error(`E2E_${role.toUpperCase()}_LOGIN_EMAIL / _PASSWORD must be set in env to capture authAs:'${role}' screenshots`)
  }
  await page.goto(`${APP_BASE_URL}/login`, { waitUntil: 'networkidle2' })
  await page.type('input[type="email"], input[name="email"], input[autocomplete="username"]', email)
  await page.type('input[type="password"]', password)
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => null),
  ])
}

async function runSetup(page: Page, steps: NonNullable<ScreenshotCapture['setup']>): Promise<void> {
  for (const s of steps) {
    if (s.action === 'click') {
      await page.waitForSelector(s.selector, { timeout: 10_000 })
      await page.click(s.selector)
    } else if (s.action === 'type') {
      await page.waitForSelector(s.selector, { timeout: 10_000 })
      await page.type(s.selector, s.value)
    } else if (s.action === 'wait') {
      if (s.selector) await page.waitForSelector(s.selector, { timeout: 10_000 })
      if (s.ms) await new Promise(r => setTimeout(r, s.ms))
    }
  }
}

async function captureOne(browser: Browser, job: CaptureJob): Promise<{ ok: boolean; error?: string }> {
  const page = await browser.newPage()
  try {
    const viewport = job.capture.viewport ?? { width: 1280, height: 800 }
    await page.setViewport(viewport)

    const authAs = job.capture.authAs ?? 'tenant'
    if (authAs !== 'public') await login(page, authAs)

    const url = job.capture.url.startsWith('http')
      ? job.capture.url
      : `${APP_BASE_URL}${job.capture.url.startsWith('/') ? '' : '/'}${job.capture.url}`
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 })

    if (job.capture.setup) await runSetup(page, job.capture.setup)

    if (!existsSync(job.outDir)) mkdirSync(job.outDir, { recursive: true })
    const outPath = join(job.outDir, job.filename)

    if (job.capture.selector) {
      const el = await page.$(job.capture.selector)
      if (!el) throw new Error(`selector not found: ${job.capture.selector}`)
      await el.screenshot({ path: outPath as `${string}.png` })
    } else {
      await page.screenshot({ path: outPath as `${string}.png`, fullPage: !!job.capture.fullPage })
    }

    return { ok: true }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  } finally {
    await page.close().catch(() => null)
  }
}

async function main() {
  const argv = process.argv.slice(2)
  const which: 'all' | 'tenant' | 'admin' =
    argv.includes('--tenant') ? 'tenant' :
    argv.includes('--admin')  ? 'admin'  : 'all'
  const filenameIdx = argv.indexOf('--filename')
  const filename = filenameIdx >= 0 ? argv[filenameIdx + 1] : undefined

  const jobs = collectJobs({ which, filename })
  if (jobs.length === 0) {
    console.log('No annotated screenshot slots match the filter. Add `capture` metadata to slots in helpContent.ts / adminHelpContent.ts.')
    return
  }

  console.log(`Capturing ${jobs.length} screenshot${jobs.length === 1 ? '' : 's'}…`)
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })

  let ok = 0, failed = 0
  const failures: Array<{ filename: string; error: string }> = []
  for (const job of jobs) {
    process.stdout.write(`  ${job.filename} … `)
    const r = await captureOne(browser, job)
    if (r.ok) { console.log('✓'); ok++ }
    else      { console.log(`✗ ${r.error ?? 'unknown error'}`); failed++; failures.push({ filename: job.filename, error: r.error ?? 'unknown error' }) }
  }
  await browser.close()

  console.log(`\nDone. ${ok} captured, ${failed} failed.`)
  if (failures.length > 0) {
    console.log('\nFailed:')
    for (const f of failures) console.log(`  ${f.filename}: ${f.error}`)
    process.exit(1)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
