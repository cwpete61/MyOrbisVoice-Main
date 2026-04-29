import { runApiSuite } from './tests/api.js'
import { runAuthSuite } from './tests/auth.js'
import { runBillingSuite } from './tests/billing.js'
import { runConfigSuite } from './tests/config-ui.js'
import { closeBrowser, type TestResult } from './harness.js'

const suiteArg = (() => {
  const idx = process.argv.indexOf('--suite')
  if (idx !== -1) return process.argv[idx + 1]
  const flag = process.argv.find((a) => a.startsWith('--suite='))
  return flag?.split('=')[1]
})()

const ALL_SUITES = ['api', 'auth', 'billing', 'config']

function summary(results: TestResult[]) {
  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length
  console.log(`\n══ TOTAL: ${passed} passed, ${failed} failed ══\n`)
  if (failed > 0) {
    console.log('Failed tests:')
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`  ✗ ${r.name}`)
      if (r.error) console.log(`      ${r.error}`)
    })
  }
}

async function main() {
  const suites = suiteArg ? [suiteArg] : ALL_SUITES

  if (suiteArg && !ALL_SUITES.includes(suiteArg)) {
    console.error(`Unknown suite: ${suiteArg}. Valid: ${ALL_SUITES.join(', ')}`)
    process.exit(1)
  }

  console.log(`\nRunning suites: ${suites.join(', ')}\n`)

  const allResults: TestResult[] = []

  for (const suite of suites) {
    let results: TestResult[] = []
    if (suite === 'api') results = await runApiSuite()
    else if (suite === 'auth') results = await runAuthSuite()
    else if (suite === 'billing') results = await runBillingSuite()
    else if (suite === 'config') results = await runConfigSuite()
    allResults.push(...results)
  }

  await closeBrowser()

  summary(allResults)

  const failed = allResults.filter((r) => !r.passed).length
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Runner crashed:', err)
  process.exit(1)
})
