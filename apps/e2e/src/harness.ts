import puppeteer, { type Browser, type BrowserContext, type Page } from 'puppeteer'
import { HEADLESS, SLOW_MO } from './config.js'

export interface TestResult {
  name: string
  passed: boolean
  error?: string
  durationMs: number
}

let browser: Browser | null = null

export async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: HEADLESS,
      slowMo: SLOW_MO,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
  }
  return browser
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close()
    browser = null
  }
}

export async function newPage(): Promise<Page> {
  const b = await getBrowser()
  const page = await b.newPage()
  page.setDefaultTimeout(15_000)
  page.setDefaultNavigationTimeout(20_000)
  page.on('console', () => {})
  page.on('pageerror', () => {})
  return page
}

export async function newIncognitoPage(): Promise<{ page: Page; context: BrowserContext }> {
  const b = await getBrowser()
  const context = await b.createBrowserContext()
  const page = await context.newPage()
  page.setDefaultTimeout(15_000)
  page.setDefaultNavigationTimeout(20_000)
  page.on('console', () => {})
  page.on('pageerror', () => {})
  return { page, context }
}

export async function runTest(name: string, fn: () => Promise<void>): Promise<TestResult> {
  const start = Date.now()
  try {
    await fn()
    return { name, passed: true, durationMs: Date.now() - start }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return { name, passed: false, error, durationMs: Date.now() - start }
  }
}

export function printResults(results: TestResult[], suite: string): void {
  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length
  console.log(`\n── ${suite} ─────────────────────────`)
  for (const r of results) {
    const icon = r.passed ? '✓' : '✗'
    const time = `${r.durationMs}ms`
    if (r.passed) {
      console.log(`  ${icon} ${r.name} (${time})`)
    } else {
      console.log(`  ${icon} ${r.name} (${time})`)
      console.log(`      ${r.error}`)
    }
  }
  console.log(`\n  ${passed} passed, ${failed} failed\n`)
}
