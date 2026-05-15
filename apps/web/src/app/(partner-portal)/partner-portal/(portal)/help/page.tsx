'use client'

import { useState, useMemo, useEffect } from 'react'
import { PARTNER_HELP_CONTENT } from '@/lib/partnerHelpContent'
import type { HelpArticle } from '@/lib/helpContent'
import { useT } from '@/lib/i18n/I18nProvider'
import { HelpScreenshot } from '@/components/HelpScreenshot'

const TEAL = 'oklch(55% 0.11 193)'

function Icon({ d, size = 15 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

function StepNumber({ n }: { n: number }) {
  return (
    <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
      style={{ background: 'oklch(55% 0.11 193 / 0.15)', color: 'oklch(45% 0.11 193)' }}>
      {n}
    </div>
  )
}

function ArticleView({ article }: { article: HelpArticle }) {
  const t = useT()
  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{article.title}</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>{article.summary}</p>

      <div className="space-y-5 mb-8 mt-6">
        {article.steps.map((step, i) => (
          <div key={i} className="flex gap-3">
            <StepNumber n={i + 1} />
            <div className="flex-1">
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{step.title}</p>
              <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--text-secondary)' }}>{step.body}</p>
              {step.screenshots?.map((s, j) => (
                <HelpScreenshot key={j} filename={s.filename} caption={s.caption} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {article.tips && article.tips.length > 0 && (
        <div className="rounded-xl p-4 mb-4" style={{ background: 'oklch(55% 0.11 193 / 0.08)', border: '1px solid oklch(55% 0.11 193 / 0.2)' }}>
          <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: 'oklch(45% 0.11 193)' }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 2a4 4 0 0 1 2 7.46V12H6v-2.54A4 4 0 0 1 8 2zm-1 10h2v2H7z" />
            </svg>
            {t('partnerHelp.tips')}
          </p>
          <ul className="space-y-1.5">
            {article.tips.map((tip, i) => (
              <li key={i} className="text-sm flex gap-2" style={{ color: 'oklch(40% 0.09 193)' }}>
                <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: TEAL }} />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl px-4 py-3 text-xs mt-6" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
        {t('partnerHelp.contactBlock')}{' '}
        <a href="mailto:support@myorbisvoice.com" style={{ color: TEAL, textDecoration: 'none' }}>support@myorbisvoice.com</a>
      </div>

      {article.lastUpdated && (
        <p className="text-[11px] italic mt-4" style={{ color: 'var(--text-tertiary)' }}>
          {t('partnerHelp.lastUpdated', { date: formatLastUpdated(article.lastUpdated) })}
        </p>
      )}
    </div>
  )
}

/** "2026-05-14" → "05/14/2026" — partner-help footer date format. */
function formatLastUpdated(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  return `${m[2]}/${m[3]}/${m[1]}`
}

export default function PartnerHelpPage() {
  const t = useT()
  const [activeArticleId, setActiveArticleId] = useState<string>(
    PARTNER_HELP_CONTENT[0]!.articles[0]!.id,
  )
  const [search, setSearch] = useState('')
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
    Object.fromEntries(PARTNER_HELP_CONTENT.map(s => [s.id, true])),
  )

  // Deep-link support: /partner-portal/help#article-id opens that article.
  useEffect(() => {
    function applyHash() {
      const hash = window.location.hash.slice(1)
      if (!hash) return
      for (const section of PARTNER_HELP_CONTENT) {
        if (section.articles.some(a => a.id === hash)) {
          setActiveArticleId(hash)
          setExpandedSections(prev => ({ ...prev, [section.id]: true }))
          return
        }
      }
    }
    applyHash()
    window.addEventListener('hashchange', applyHash)
    return () => window.removeEventListener('hashchange', applyHash)
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return PARTNER_HELP_CONTENT
    const q = search.toLowerCase()
    return PARTNER_HELP_CONTENT.map(section => ({
      ...section,
      articles: section.articles.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.steps.some(s => s.title.toLowerCase().includes(q) || s.body.toLowerCase().includes(q)),
      ),
    })).filter(s => s.articles.length > 0)
  }, [search])

  const activeArticle = useMemo(() => {
    for (const section of PARTNER_HELP_CONTENT) {
      const found = section.articles.find(a => a.id === activeArticleId)
      if (found) return found
    }
    return PARTNER_HELP_CONTENT[0]!.articles[0]!
  }, [activeArticleId])

  function toggleSection(id: string) {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function selectArticle(id: string) {
    setActiveArticleId(id)
    for (const section of PARTNER_HELP_CONTENT) {
      if (section.articles.some(a => a.id === id)) {
        setExpandedSections(prev => ({ ...prev, [section.id]: true }))
        break
      }
    }
  }

  return (
    <div className="flex gap-0" style={{ minHeight: 'calc(100vh - 4rem)', margin: '-2rem' }}>
      <aside className="w-64 flex-shrink-0 flex flex-col" style={{ background: 'var(--surface-raised)', borderRight: '1px solid var(--border-subtle)' }}>
        <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <p className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>{t('partnerHelp.title')}</p>
          <div className="relative">
            <svg className="absolute left-2.5 top-2.5" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-tertiary)' }}>
              <circle cx="7" cy="7" r="5"/><path d="m13 13-3-3"/>
            </svg>
            <input
              type="text"
              placeholder={t('partnerHelp.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-lg text-xs"
              style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {filtered.map(section => (
            <div key={section.id} className="mb-1">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold"
                style={{ color: 'var(--text-tertiary)' }}
              >
                <Icon d={section.icon} size={13} />
                <span className="flex-1 text-left">{section.label.toUpperCase()}</span>
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  style={{ transform: expandedSections[section.id] ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}>
                  <path d="M4 6l4 4 4-4"/>
                </svg>
              </button>

              {expandedSections[section.id] && (
                <div>
                  {section.articles.map(article => (
                    <button
                      key={article.id}
                      onClick={() => selectArticle(article.id)}
                      className="w-full text-left px-4 py-2 text-sm pl-9 rounded-lg mx-1"
                      style={{
                        width: 'calc(100% - 8px)',
                        background: activeArticleId === article.id ? 'var(--nav-active-bg)' : 'transparent',
                        color: activeArticleId === article.id ? 'var(--nav-active-text)' : 'var(--text-secondary)',
                        fontWeight: activeArticleId === article.id ? 600 : 400,
                      }}
                    >
                      {article.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {filtered.length === 0 && (
            <p className="px-4 py-6 text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
              {t('partnerHelp.noResults', { query: search })}
            </p>
          )}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto px-10 py-8">
        {activeArticle && <ArticleView article={activeArticle} />}
      </main>
    </div>
  )
}
