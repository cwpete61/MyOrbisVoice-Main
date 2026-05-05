#!/usr/bin/env tsx
/**
 * i18n coverage scanner.
 *
 * Two checks:
 *   1. Dictionary parity — every key in en.json must exist in es.json (and
 *      vice versa). Missing keys in es.json mean Spanish users see the
 *      English fallback, which is silent drift.
 *   2. Hardcoded English in TSX — visible JSX text and aria-label / placeholder
 *      strings that aren't wrapped in t(). These render as English in BOTH
 *      languages, which is the worst kind of drift because there's no key to
 *      backfill.
 *
 * Exit code:
 *   0  → no gaps
 *   1  → gaps found (use to fail CI / pre-commit hooks)
 *
 * Usage:
 *   pnpm i18n:check              # scan everything (web app)
 *   pnpm i18n:check --quiet      # only print summary, not per-file detail
 *   pnpm i18n:check --strings-only   # skip dictionary parity, only scan TSX
 *   pnpm i18n:check --keys-only      # skip TSX scan, only check parity
 *
 * Universal references that are intentionally English in both languages
 * (per CLAUDE.md bilingual rule) — the scanner allow-lists these so they don't
 * count as "missing translations".
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const REPO_ROOT = join(__dirname, '..')
const DICT_DIR = join(REPO_ROOT, 'apps/web/src/lib/i18n/dictionaries')
const SCAN_ROOTS = [
  'apps/web/src/app/(dashboard)',
  'apps/web/src/app/(partner-portal)',
  'apps/web/src/app/(admin)',
  'apps/web/src/components',
]

// Words/phrases that are intentionally English in both languages.
const ALLOW_PHRASES = new Set([
  // Brand
  'MyOrbisVoice', 'OrbisVoice',
  // Provider names
  'Stripe', 'Twilio', 'Google', 'Gmail', 'Gemini', 'WhatsApp', 'Bunny',
  'Stripe Connect', 'Stripe Connect Express', 'Google Calendar', 'Google OAuth',
  'OpenAI', 'Reoon',
  // Voice names
  'Zephyr', 'Despina', 'Aoede', 'Charon', 'Fenrir', 'Puck', 'Sulafat',
  // Plan names
  'Free', 'Basic', 'Pro', 'LTD', 'Premier', 'Enterprise',
  // Tax forms
  'W-9', 'W-8BEN', '1099-NEC',
  // Universal short bits
  'Active', 'Loading', 'Save', 'Cancel', 'Delete', 'Edit', 'Copy', // single-word states are usually OK alone but flag if in prose
])

// ── Dictionary parity ─────────────────────────────────────────────────────────

function flatKeys(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return []
  const out: string[] = []
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object') out.push(...flatKeys(v, path))
    else out.push(path)
  }
  return out
}

function checkParity(): { onlyInEn: string[]; onlyInEs: string[] } {
  const en = JSON.parse(readFileSync(join(DICT_DIR, 'en.json'), 'utf8'))
  const es = JSON.parse(readFileSync(join(DICT_DIR, 'es.json'), 'utf8'))
  const enKeys = new Set(flatKeys(en))
  const esKeys = new Set(flatKeys(es))
  return {
    onlyInEn: [...enKeys].filter(k => !esKeys.has(k)).sort(),
    onlyInEs: [...esKeys].filter(k => !enKeys.has(k)).sort(),
  }
}

// ── Hardcoded English in TSX ──────────────────────────────────────────────────

interface Hit {
  file: string
  line: number
  text: string
  kind: 'jsx-text' | 'placeholder' | 'aria-label' | 'title-attr'
}

function* walkTsx(dir: string): Generator<string> {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch { return }
  for (const e of entries) {
    const full = join(dir, e)
    let st
    try { st = statSync(full) } catch { continue }
    if (st.isDirectory()) {
      // Skip node_modules and .next
      if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue
      yield* walkTsx(full)
    } else if (e.endsWith('.tsx')) {
      yield full
    }
  }
}

/** Heuristic: a string looks like translatable English prose if it contains
 *  at least one capitalized word followed by a lowercase letter, plus a
 *  whitespace, and isn't entirely allow-listed. */
function looksEnglish(s: string): boolean {
  const trimmed = s.trim()
  if (trimmed.length < 3) return false
  if (!/[a-zA-Z]/.test(trimmed)) return false
  if (ALLOW_PHRASES.has(trimmed)) return false
  // All caps acronyms / codes (e.g. "BOOKED", "API")
  if (/^[A-Z0-9_]+$/.test(trimmed)) return false
  // Single uppercase word with no spaces (likely a code or proper noun)
  if (!/\s/.test(trimmed) && /^[A-Z]/.test(trimmed)) return false
  // Has at least one letter pair like "Le" or " a "
  return /[A-Z][a-z]/.test(trimmed) || / [a-z]/.test(trimmed)
}

function scanFile(file: string): Hit[] {
  const text = readFileSync(file, 'utf8')
  const hits: Hit[] = []
  // If the file uses t(), we still scan — it might have remnants.
  // But we skip files that are clearly translation dictionaries.
  if (file.endsWith('.json')) return hits

  const lines = text.split('\n')

  // (1) JSX text content: > Foo Bar <  (between tag close and open)
  // Conservative regex: ASCII text between > and <, excluding things like {expr} or attributes.
  const jsxText = />([^<>{}]+?)</g
  // (2) attribute strings on attributes likely user-facing
  const attrPlaceholder = /placeholder\s*=\s*"([^"]+)"/g
  const attrAriaLabel  = /aria-label\s*=\s*"([^"]+)"/g
  const attrTitle       = /title\s*=\s*"([^"]+)"/g

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    let m: RegExpExecArray | null

    while ((m = jsxText.exec(line))) {
      const candidate = m[1]!
      if (looksEnglish(candidate)) hits.push({ file, line: i + 1, text: candidate.trim(), kind: 'jsx-text' })
    }
    while ((m = attrPlaceholder.exec(line))) {
      const candidate = m[1]!
      if (looksEnglish(candidate)) hits.push({ file, line: i + 1, text: candidate, kind: 'placeholder' })
    }
    while ((m = attrAriaLabel.exec(line))) {
      const candidate = m[1]!
      if (looksEnglish(candidate)) hits.push({ file, line: i + 1, text: candidate, kind: 'aria-label' })
    }
    while ((m = attrTitle.exec(line))) {
      const candidate = m[1]!
      if (looksEnglish(candidate)) hits.push({ file, line: i + 1, text: candidate, kind: 'title-attr' })
    }
  }

  return hits
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const args = new Set(process.argv.slice(2))
  const stringsOnly = args.has('--strings-only')
  const keysOnly = args.has('--keys-only')
  const quiet = args.has('--quiet')

  let exitCode = 0

  // ── Dictionary parity ──
  if (!stringsOnly) {
    const { onlyInEn, onlyInEs } = checkParity()
    console.log('═══ Dictionary parity ═══')
    if (onlyInEn.length === 0 && onlyInEs.length === 0) {
      console.log('  ✓ en.json and es.json have identical key sets')
    } else {
      if (onlyInEn.length > 0) {
        console.log(`  ✗ ${onlyInEn.length} keys in en.json missing from es.json:`)
        if (!quiet) onlyInEn.forEach(k => console.log(`      ${k}`))
        exitCode = 1
      }
      if (onlyInEs.length > 0) {
        console.log(`  ⚠ ${onlyInEs.length} keys in es.json missing from en.json:`)
        if (!quiet) onlyInEs.forEach(k => console.log(`      ${k}`))
      }
    }
    console.log('')
  }

  // ── Hardcoded English ──
  if (!keysOnly) {
    console.log('═══ Hardcoded English in TSX ═══')
    const allHits: Hit[] = []
    for (const root of SCAN_ROOTS) {
      const fullRoot = join(REPO_ROOT, root)
      for (const file of walkTsx(fullRoot)) {
        allHits.push(...scanFile(file))
      }
    }
    if (allHits.length === 0) {
      console.log('  ✓ No hardcoded English JSX text or attribute strings detected')
    } else {
      const byFile = new Map<string, Hit[]>()
      for (const h of allHits) {
        const arr = byFile.get(h.file) ?? []
        arr.push(h)
        byFile.set(h.file, arr)
      }
      const sortedFiles = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)
      console.log(`  ✗ ${allHits.length} hardcoded English strings across ${byFile.size} files:`)
      console.log('')
      for (const [file, hits] of sortedFiles.slice(0, quiet ? 10 : sortedFiles.length)) {
        const rel = relative(REPO_ROOT, file)
        console.log(`  ${rel}  (${hits.length})`)
        if (!quiet) {
          for (const h of hits.slice(0, 8)) {
            const t = h.text.length > 60 ? h.text.slice(0, 57) + '...' : h.text
            console.log(`    L${h.line}  [${h.kind}]  "${t}"`)
          }
          if (hits.length > 8) console.log(`    … ${hits.length - 8} more`)
        }
      }
      if (quiet && sortedFiles.length > 10) {
        console.log(`  … ${sortedFiles.length - 10} more files (run without --quiet to see all)`)
      }
      exitCode = 1
    }
  }

  console.log('')
  if (exitCode === 0) {
    console.log('✓ i18n coverage clean')
  } else {
    console.log('✗ i18n coverage gaps detected — run pnpm i18n:fill to backfill missing es.json keys, or wrap remaining hardcoded strings in t().')
  }

  process.exit(exitCode)
}

main()
