export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000'
export const HEADLESS = process.env.E2E_HEADLESS !== 'false'
export const SLOW_MO = Number(process.env.E2E_SLOW_MO ?? '0')

// Test credentials — never reuse real accounts
export const TEST_USER = {
  email: `e2e-${Date.now()}@test.local`,
  password: 'E2eTest1234!',
  businessName: 'E2E Test Business',
}
