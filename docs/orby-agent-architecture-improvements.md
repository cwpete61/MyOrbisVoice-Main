# Orby Agent Architecture — Improvements Backlog

**Captured:** 2026-05-25 · **Source:** OpenSwarm study (`/home/orbis/Antigravity/OpenSwarm/`, VRSEN/agency-swarm pattern) · **Owner:** Voice runtime + prompt-engine

## What Orby is today (architecture as built)

- **Single Gemini Live runtime.** One model holds the entire conversation.
- **Seven agent ROLES = seven prompt overlays**, not seven processes. Roles are loaded as Layer-4 entries in `apps/voice-gateway/src/lib/prompt-resolver.ts`.
- **No actual handoff or transfer infra.** When the caller's intent shifts mid-call, the same model swaps tone/rules by virtue of all role prompts being concatenated in the system prompt.
- **`AgentProfile` rows** in DB just track per-tenant config (model, prompt version, enabled flag) — they aren't separate runtime workers.

This works fine at sub-second latency (which a real multi-process router would NOT) but loses some of the discipline a true multi-agent system delivers. OpenSwarm's separated-runtime pattern can't be lifted wholesale, but several of its prompt-discipline rules can.

## Shipped 2026-05-25

### ✅ #4 — Action-ownership rule (platform baseline)

**Edit:** `apps/voice-gateway/src/lib/prompt-resolver.ts` — added Action-ownership clause to the platform baseline (Layer 1). Rule: whichever role/specialist performs a tool-completed action OWNS the user-facing confirmation in ONE place; no double-narration ("Let me book that... [tool] ...I've booked that"), no internal-mechanics chatter ("I've saved your contact to our database"). Caller hears the OUTCOME, not the plumbing. Same rule covers failure narration — own it once in the same turn.

**Why:** Lifted from OpenSwarm's file-delivery rule ("specialists own delivery end-to-end"). Adapted for voice: the rule applies to every tool-driven action — book, save, send, record. Cleaner caller UX, fewer awkward "I'm doing X... I've done X" sandwiches.

**Verification:** `pnpm --filter @voiceautomation/voice-gateway build` clean. Behavior surfaces immediately on next deploy — applies to every call.

### ✅ #3 — Direct specialist-to-specialist transfer + mid-flow tolerance

**Edit:** `apps/voice-gateway/src/lib/prompt-resolver.ts` — extended Layer 4.0 Specialist Routing meta with two new sections:

- **DIRECT TRANSFER:** when already pinned and caller pivots to a different multi-turn flow, call `enter_specialist(role:"<NEW>", ...)` directly — supersedes the prior pin in one tool call, no exit→re-enter pair. Example: pinned on SALES handling pricing, caller says "forget pricing, book me for Tuesday" → single `enter_specialist(role:"APPOINTMENT")` call.
- **MID-FLOW TOLERANCE:** while pinned, absorb brief topical detours in-line without exiting. Example: pinned on APPOINTMENT mid-booking, caller asks "are you open Saturdays?" → answer in one sentence, continue the booking, do NOT exit. Only exit/transfer when the new intent clearly consumes multiple turns.

**Why:** Direct transfer matters when we eventually move to a true multi-runtime (OpenSwarm pattern). For now, single-runtime gains are the latency win of skipping an `exit_specialist` round trip + the conversational continuity of mid-flow tolerance (prevents fragmented calls).

**Verification:** `pnpm --filter @voiceautomation/voice-gateway build` clean. Surfaces on next deploy + first multi-role tenant call with a pin already active.

### ✅ #2 — Single-specialist Handoff (soft-pin via tools)

**Edits:**
- `apps/voice-gateway/src/services/tools.ts` — added `enter_specialist(role, reason)` + `exit_specialist(reason)` tool declarations and handlers. Validates role against the pinnable set (APPOINTMENT, SALES, CUSTOMER_SERVICE, MARKETING, ASSISTANT, SECRETARY — ORCHESTRATOR is not pinnable). Handlers return strong tool_response guidance telling the model to lock onto the pinned role until exit.
- `apps/voice-gateway/src/lib/prompt-resolver.ts` — extended the Layer 4.0 Specialist Routing meta with a "HANDOFF — when to pin onto one specialist" section listing pin/no-pin examples and exit conditions.
- `buildToolGuidanceBlock()` — updated tool count (6→8) and added entries for the two new tools.

**Approach (soft-pin, not hard-pin):** Gemini Live cannot mutate its system instruction mid-session, so the "pin" is enforced by strong tool_response guidance rather than by dynamically swapping role prompts. The model already has every loaded role in its system instruction; the tool just tells it which one to active-pin and to stop cross-routing per turn. Caller hears nothing — the handoff is silent.

**Why this is the right shape for Orby:**
- No session reset, no audio gap, no system-prompt mutation
- Pure prompt + tool design — works with Gemini Live as-it-exists
- Self-healing: if the model ignores the pin, the Specialist Routing meta still wraps it correctly
- Easy to evolve: if/when we add hard-pin (true Layer-4 filtering) later, the tool contract stays the same

**Verification:** `pnpm --filter @voiceautomation/voice-gateway build` clean. Behavior surfaces on next deploy + first call with 2+ ROLE prompts where the model identifies a multi-turn flow.

### ✅ #1 — Tighten Orchestrator to ROUTING-ONLY (prompt-layer meta)

**Edit:** `apps/voice-gateway/src/lib/prompt-resolver.ts` — added Layer 4.0 "Specialist Routing" meta that fires when 2+ ROLE prompts are loaded. Tells the single Gemini Live model:

- Detect caller intent every turn, apply matching specialist's rules
- Switch silently — no "transferring you" / "let me get someone else"
- Stay on the active specialist until intent clearly shifts
- Fall back to platform baseline when no specialist matches
- Never announce which specialist is active

**Why:** OpenSwarm's Orchestrator instructions enforce "you only route, you never execute." Translated to our single-runtime setup, the model itself must self-route across loaded specialists WITHOUT breaking the illusion of one assistant. Previously the role prompts were concatenated with no meta-instruction on HOW to route across them, leaving the model to guess.

**Verification:** `pnpm --filter @voiceautomation/voice-gateway build` — clean. Behavior change will surface on next deploy of voice-gateway. No DB migration needed.

## Backlog — not yet shipped

### #5 — Per-role reasoning-effort tiers

Today every Orby role uses the same model (`gpt-4o-mini` per `agent.service.ts:20`). OpenSwarm sets different `Reasoning(effort=...)` per agent. For Orby:

- Routing meta (Layer 4.0) and Orchestrator role → fastest path, minimal reasoning
- Sales + Customer Service → medium reasoning (need to handle objections, edge cases)
- Appointment → minimal (deterministic flow)
- Marketing + Secretary → minimal

**For Gemini Live:** there is no separate reasoning-effort knob, but the model choice CAN differ per role if we keep them all gpt-4o-mini today. Worth revisiting when we add a higher-tier model for Sales.

**Effort:** small (data-only change in DEFAULT_AGENT_SETTINGS).

### #6 — Conversation starters per role (UX surface)

OpenSwarm exposes `conversation_starters=[...]` per agent. For Orby this could populate the partner-portal "Try Orby" demo: pick a role card, see the starter prompts that role responds best to, click to fire a test call.

**Effort:** small (UI + per-role starter strings).

## What to NOT lift from OpenSwarm

- **Agency Swarm framework itself.** Text/file-batch oriented. Orby is sub-second voice via Gemini Live. Wrong tool.
- **Files-folder per agent.** Orby's outputs are calls / SMS / calendar writes / CRM rows, not files.
- **Multi-pass reflection.** Fine for slide decks; tanks voice latency.
- **OpenAI `Reasoning(effort=...)` literal.** Gemini Live has its own latency budget; don't graft OpenAI's knob.

## How OpenSwarm validates the direction

OpenSwarm proves that **strict routing-only orchestration + clean handoff/transfer separation** ships in production multi-agent systems and reduces orchestrator failure modes. We can adopt the DISCIPLINE without adopting the runtime — that's #1 (shipped today) and the rest of the backlog above.

## Repo + references

- OpenSwarm source: `/home/orbis/Antigravity/OpenSwarm/` (cloned 2026-05-24)
- Key files studied:
  - `orchestrator/orchestrator.py` + `orchestrator/instructions.md` — routing-only contract
  - `swarm.py` — agency wiring (8 specialists + bidirectional comm flow graph)
  - `docs_agent/docs_agent.py` — specialist shape (tools, instructions, model settings)
- Pre-study DB snapshot: `backups/db_20260524_225216_pre-openswarm-study.dump`
