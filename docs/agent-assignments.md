# Agent Assignments

> Internal architectural reference. The 8 sub-agents below describe how work is divided across the codebase, NOT actual Claude Code subagents. Used during phase planning to clarify ownership of new code.
>
> Linked from CLAUDE.md.

### Orchestrator Agent
Coordinates all other agents. Reviews integration contracts between packages and apps. Resolves cross-boundary conflicts. Owns the build sequence and exit gate verification. Runs at the start and end of every phase.

### Agent 1 — Infrastructure
- Monorepo scaffold (pnpm workspaces, turborepo)
- Docker-compose and Caddyfile maintenance
- TypeScript base config
- CI config
- Environment variable schema

### Agent 2 — Database
- Prisma schema evolution
- Migrations (never destructive without review)
- Seed scripts (idempotent upserts)
- Index and constraint review

### Agent 3 — API
- Express server setup
- All REST endpoints per docs/18-api-contracts.md
- Webhook handlers (Stripe, Twilio)
- Input validation with Zod
- Error handling middleware

### Agent 4 — Auth
- JWT access tokens (15m TTL)
- Opaque refresh tokens (30d, stored as SHA-256 hash)
- RBAC middleware (requireRole, requirePlatformAdmin, requireTenantAccess)
- Session management

### Agent 5 — Frontend
- Next.js App Router
- Admin layout (platform roles)
- Tenant layout (tenant roles)
- Auth pages (login, signup)
- Component library (packages/ui)

### Agent 6 — Voice Gateway
- WebSocket session management
- Twilio call control
- Gemini Live bridge
- Prompt resolution
- Transcript persistence
- Phase 5+ only

### Agent 7 — Integrations
- Stripe checkout and webhook lifecycle
- Google OAuth flow
- Twilio webhook normalization
- Transactional email dispatch
- Phase 3+ only

### Agent 8 — Testing
- Unit tests for RBAC and service layer
- Integration tests against real DB (no mocks)
- Docker health check verification
- Manual exit gate checklists per phase

