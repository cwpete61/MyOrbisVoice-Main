// Direct API smoke tests — no browser needed
import { API_URL } from '../config.js'
import { runTest, printResults } from '../harness.js'

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  const body = await res.json() as Record<string, unknown>
  return { status: res.status, body }
}

export async function runApiSuite() {
  const results = await Promise.all([

    runTest('GET /health → ok', async () => {
      const { status, body } = await apiFetch('/health')
      if (status !== 200) throw new Error(`Expected 200, got ${status}`)
      if ((body as { status?: string }).status !== 'ok') throw new Error('status not ok')
    }),

    runTest('GET /health checks database + redis', async () => {
      const { body } = await apiFetch('/health')
      const checks = (body as { checks?: Record<string, string> }).checks
      if (checks?.database !== 'ok') throw new Error(`database: ${checks?.database}`)
      if (checks?.redis !== 'ok') throw new Error(`redis: ${checks?.redis}`)
    }),

    runTest('GET /api/billing/plans → 3 plans (public, no auth)', async () => {
      const { status, body } = await apiFetch('/api/billing/plans')
      if (status !== 200) throw new Error(`Expected 200, got ${status}`)
      const data = (body as { data?: unknown[] }).data
      if (!Array.isArray(data) || data.length !== 3) throw new Error(`Expected 3 plans, got ${data?.length}`)
    }),

    runTest('GET /api/billing/plans has entitlements on each plan', async () => {
      const { body } = await apiFetch('/api/billing/plans')
      const plans = (body as { data?: Array<{ entitlements?: unknown[] }> }).data ?? []
      for (const plan of plans) {
        if (!plan.entitlements?.length) throw new Error(`Plan missing entitlements`)
      }
    }),

    runTest('GET /api/tenants/current without auth → 401', async () => {
      const { status } = await apiFetch('/api/tenants/current')
      if (status !== 401) throw new Error(`Expected 401, got ${status}`)
    }),

    runTest('GET /api/admin/tenants without auth → 401', async () => {
      const { status } = await apiFetch('/api/admin/tenants')
      if (status !== 401) throw new Error(`Expected 401, got ${status}`)
    }),

    runTest('POST /api/webhooks/stripe with bad signature → error (4xx or 5xx)', async () => {
      const { status } = await apiFetch('/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'bad', 'Content-Type': 'application/json' },
        body: '{}',
      })
      if (status < 400) throw new Error(`Expected error status, got ${status}`)
    }),

  ])

  // Auth flow — sequential (each step depends on previous)
  const signupEmail = `api-test-${Date.now()}@test.local`
  let accessToken = ''

  const authResult = await runTest('POST /api/auth/signup → user + tenant + tokens', async () => {
    const { status, body } = await apiFetch('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email: signupEmail, password: 'Test1234!', businessName: 'API Test Co' }),
    })
    if (status !== 201) throw new Error(`Expected 201, got ${status}: ${JSON.stringify(body)}`)
    const data = body.data as Record<string, unknown>
    if (!data?.accessToken) throw new Error('No accessToken in response')
    if (!data?.tenant) throw new Error('No tenant in response')
    accessToken = data.accessToken as string
  })
  results.push(authResult)

  const meResult = await runTest('GET /api/auth/me → user + memberships', async () => {
    if (!accessToken) throw new Error('No token from signup')
    const { status, body } = await apiFetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (status !== 200) throw new Error(`Expected 200, got ${status}`)
    const data = body.data as Record<string, unknown>
    if (!data?.user) throw new Error('No user in /me response')
    if (!Array.isArray(data?.memberships)) throw new Error('No memberships in /me response')
  })
  results.push(meResult)

  const entResult = await runTest('GET /api/entitlements → starter plan seeded on signup', async () => {
    if (!accessToken) throw new Error('No token from signup')
    const { status, body } = await apiFetch('/api/entitlements', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (status !== 200) throw new Error(`Expected 200, got ${status}`)
    const data = body.data as Record<string, unknown>
    if (typeof data?.widget_enabled !== 'boolean') throw new Error('Missing widget_enabled entitlement')
    if (typeof data?.max_channels !== 'number') throw new Error('Missing max_channels entitlement')
  })
  results.push(entResult)

  const tenantResult = await runTest('GET /api/tenants/current → workspace data', async () => {
    if (!accessToken) throw new Error('No token from signup')
    const { status, body } = await apiFetch('/api/tenants/current', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (status !== 200) throw new Error(`Expected 200, got ${status}`)
    const data = body.data as Record<string, unknown>
    if (!data?.id) throw new Error('No tenant id in response')
    if (!data?.displayName) throw new Error('No displayName in response')
  })
  results.push(tenantResult)

  const adminBlockResult = await runTest('GET /api/admin/tenants with tenant_owner → 403', async () => {
    if (!accessToken) throw new Error('No token from signup')
    const { status } = await apiFetch('/api/admin/tenants', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (status !== 403) throw new Error(`Expected 403, got ${status}`)
  })
  results.push(adminBlockResult)

  printResults(results, 'API')
  return results
}
