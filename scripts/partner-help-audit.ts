#!/usr/bin/env tsx
/**
 * Partner-help drift detector.
 *
 * For each article in PARTNER_HELP_CONTENT, walk every directory listed in its
 * `sourcePaths` (fallback: the section.id ↔ portal directory name convention),
 * read `git log -1 --format=%cI -- <dir>` to get the wall-clock of the most
 * recent code change to that surface, and compare it against the article's
 * `lastUpdated` field.
 *
 * Output:
 *   - Print a per-article report: OK / STALE / UNDATED / NO_SOURCE.
 *   - Exit non-zero when any article is STALE or UNDATED so the nightly cron
 *     can surface drift via the job's exit code.
 *
 * Designed to run from repo root via `pnpm partner-help:audit`. Can also be
 * invoked with `--json` to emit a machine-readable report for downstream tools
 * (an LLM-driven sync agent, future Slack notifier, etc.).
 */
import { execSync } from 'node:child_process'
import { resolve } from 'node:path'
import { PARTNER_HELP_CONTENT } from '../apps/web/src/lib/partnerHelpContent'

const REPO_ROOT = resolve(process.cwd())
const PORTAL_BASE = 'apps/web/src/app/(partner-portal)/partner-portal/(portal)'

type Report = {
  sectionId:     string
  articleId:     string
  title:         string
  lastUpdated:   string | null
  sourcePaths:   string[]
  latestChange:  string | null  // ISO
  status:        'OK' | 'STALE' | 'UNDATED' | 'NO_SOURCE'
  daysBehind?:   number
}

function lastCommitForDir(dir: string): string | null {
  try {
    const out = execSync(
      `git log -1 --format=%cI -- "${dir}"`,
      { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim()
    return out || null
  } catch {
    return null
  }
}

function resolveSourcePaths(sectionId: string, sourcePaths: string[] | undefined): string[] {
  if (sourcePaths && sourcePaths.length > 0) {
    return sourcePaths.map(p => `${PORTAL_BASE}/${p}`)
  }
  // Convention: section.id is dashed (e.g. "phone-numbers") and matches the
  // portal page directory. Map best-effort.
  const map: Record<string, string> = {
    'getting-started':         'dashboard',
    'landing-pages':           'landing-page',
    'public-booking':          'profile',
    'phone-numbers':           'phone-numbers',
    'crm':                     'crm',
    'mailbox':                 'mailbox',
    'campaigns':               'campaigns',
    'conversations':           'conversations',
    'commissions-payouts':     'commissions',
    'reminders-and-calendar':  'profile',
    'marketing-tools':         'marketing-kit',
  }
  const dir = map[sectionId] ?? sectionId
  return [`${PORTAL_BASE}/${dir}`]
}

function daysBetween(a: string, b: string): number {
  return Math.floor((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000)
}

function audit(): Report[] {
  const out: Report[] = []
  for (const section of PARTNER_HELP_CONTENT) {
    for (const article of section.articles) {
      const sourcePaths = resolveSourcePaths(section.id, article.sourcePaths)

      const latestPerPath = sourcePaths.map(lastCommitForDir).filter(Boolean) as string[]
      const latestChange = latestPerPath.length
        ? latestPerPath.sort().reverse()[0]!
        : null

      let status: Report['status']
      let daysBehind: number | undefined
      if (!latestChange) {
        status = 'NO_SOURCE'
      } else if (!article.lastUpdated) {
        status = 'UNDATED'
      } else {
        const diff = daysBetween(latestChange, article.lastUpdated)
        if (diff > 0) {
          status = 'STALE'
          daysBehind = diff
        } else {
          status = 'OK'
        }
      }

      out.push({
        sectionId:    section.id,
        articleId:    article.id,
        title:        article.title,
        lastUpdated:  article.lastUpdated ?? null,
        sourcePaths,
        latestChange,
        status,
        ...(daysBehind != null ? { daysBehind } : {}),
      })
    }
  }
  return out
}

function main(): void {
  const report = audit()
  const wantJson = process.argv.includes('--json')

  if (wantJson) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    const fmt = (s: Report) => {
      const tag =
        s.status === 'OK'        ? '✓ OK     '
      : s.status === 'STALE'     ? '⚠ STALE  '
      : s.status === 'UNDATED'   ? '? UNDATED'
      :                            '· NO_SRC '
      const detail =
        s.status === 'STALE'   ? `  (${s.daysBehind}d behind — article ${s.lastUpdated}, code ${s.latestChange?.slice(0, 10)})`
      : s.status === 'UNDATED' ? `  (code last changed ${s.latestChange?.slice(0, 10)} — set lastUpdated)`
      : s.status === 'NO_SOURCE' ? `  (no git history for ${s.sourcePaths.join(', ')})`
      : ''
      return `  ${tag}  ${s.sectionId} / ${s.articleId}${detail}`
    }
    console.log('Partner help drift report')
    console.log('═════════════════════════')
    console.log()
    for (const r of report) console.log(fmt(r))
    console.log()
    const stale    = report.filter(r => r.status === 'STALE').length
    const undated  = report.filter(r => r.status === 'UNDATED').length
    const ok       = report.filter(r => r.status === 'OK').length
    const noSrc    = report.filter(r => r.status === 'NO_SOURCE').length
    console.log(`  ${ok} OK · ${stale} stale · ${undated} undated · ${noSrc} no source`)
  }

  // Exit non-zero on drift so cron / CI can branch on the result.
  const driftCount = report.filter(r => r.status === 'STALE' || r.status === 'UNDATED').length
  if (driftCount > 0) process.exit(1)
}

main()
