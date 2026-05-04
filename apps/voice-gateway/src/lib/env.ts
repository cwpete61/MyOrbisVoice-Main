import 'dotenv/config'

function req(key: string, fallbackKey?: string): string {
  const v = process.env[key] ?? (fallbackKey ? process.env[fallbackKey] : undefined)
  if (!v) throw new Error(`Missing required env var: ${key}${fallbackKey ? ` (or ${fallbackKey})` : ''}`)
  return v
}

function opt(key: string, fallbackKey?: string): string {
  return process.env[key] ?? (fallbackKey ? process.env[fallbackKey] : undefined) ?? ''
}

export const env = {
  PORT: parseInt(process.env['GATEWAY_PORT'] ?? '5000', 10),
  GEMINI_API_KEY: opt('GEMINI_API_KEY', 'GOOGLE_GEMINI_API_KEY'),
  OPENAI_API_KEY: opt('OPENAI_API_KEY'),
  AUTH_SECRET: req('AUTH_SECRET'),
  // Used by the tool-calling registry to call API internal-gateway endpoints.
  // Both vars must match what the API container has — see infra/.env.prod.
  API_BASE_URL:            opt('API_BASE_URL') || 'http://localhost:4000',
  GATEWAY_INTERNAL_TOKEN:  opt('GATEWAY_INTERNAL_TOKEN'),
  NODE_ENV: process.env['NODE_ENV'] ?? 'development',
}
