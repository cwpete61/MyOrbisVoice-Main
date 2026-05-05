'use client'

import { useState, useMemo, useEffect } from 'react'
import { HELP_CONTENT, type HelpArticle } from '@/lib/helpContent'
import { HelpTemplateBlock } from '@/components/HelpTemplateBlock'
import { HelpScreenshot } from '@/components/HelpScreenshot'
import { WebsiteChecker } from '@/components/WebsiteChecker'
import { useT, useLocale } from '@/lib/i18n/I18nProvider'

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

      {article.id === 'integrations-twilio-website' && <WebsiteChecker />}

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
              {step.template && (
                <HelpTemplateBlock label={step.template.label} content={step.template.content} />
              )}
              {step.link && (
                <a
                  href={step.link.href}
                  target={step.link.href.startsWith('http') ? '_blank' : undefined}
                  rel={step.link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
                  style={{ background: 'oklch(55% 0.11 193 / 0.12)', color: 'oklch(40% 0.13 193)', textDecoration: 'none', border: '1px solid oklch(55% 0.11 193 / 0.3)' }}
                >
                  {step.link.label}
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 3l5 5-5 5" />
                  </svg>
                </a>
              )}
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
            {t('tenantHelp.tips')}
          </p>
          <ul className="space-y-1.5">
            {article.tips.map((tip, i) => (
              <li key={i} className="text-sm flex gap-2" style={{ color: 'oklch(40% 0.09 193)' }}>
                <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: 'oklch(55% 0.11 193)' }} />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {article.warnings && article.warnings.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'oklch(60% 0.18 30 / 0.08)', border: '1px solid oklch(60% 0.18 30 / 0.25)' }}>
          <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: 'oklch(45% 0.16 30)' }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 2L1 14h14L8 2zm0 4v4m0 2.5v.5" />
            </svg>
            {t('tenantHelp.important')}
          </p>
          <ul className="space-y-1.5">
            {article.warnings.map((w, i) => (
              <li key={i} className="text-sm flex gap-2" style={{ color: 'oklch(40% 0.14 30)' }}>
                <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: 'oklch(55% 0.18 30)' }} />
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function HelpPage() {
  const t = useT()
  const { locale } = useLocale()
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US'
  void dateLocale
  const [activeArticleId, setActiveArticleId] = useState<string>(
    HELP_CONTENT[0]!.articles[0]!.id
  )
  const [search, setSearch] = useState('')
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
    Object.fromEntries(HELP_CONTENT.map(s => [s.id, true]))
  )

  // Deep-link support: if URL has #article-id, open that article on mount
  // (also responds to in-page hash changes — e.g. nav from another tab)
  useEffect(() => {
    function applyHash() {
      const hash = window.location.hash.slice(1)
      if (!hash) return
      for (const section of HELP_CONTENT) {
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
    if (!search.trim()) return HELP_CONTENT
    const q = search.toLowerCase()
    return HELP_CONTENT.map(section => ({
      ...section,
      articles: section.articles.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.steps.some(s => s.title.toLowerCase().includes(q) || s.body.toLowerCase().includes(q))
      ),
    })).filter(s => s.articles.length > 0)
  }, [search])

  const activeArticle = useMemo(() => {
    for (const section of HELP_CONTENT) {
      const found = section.articles.find(a => a.id === activeArticleId)
      if (found) return found
    }
    return HELP_CONTENT[0]!.articles[0]!
  }, [activeArticleId])

  function toggleSection(id: string) {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function selectArticle(id: string) {
    setActiveArticleId(id)
    // Expand the section that contains this article
    for (const section of HELP_CONTENT) {
      if (section.articles.some(a => a.id === id)) {
        setExpandedSections(prev => ({ ...prev, [section.id]: true }))
        break
      }
    }
  }

  return (
    <div className="flex gap-0" style={{ minHeight: 'calc(100vh - 4rem)', margin: '-2rem' }}>
      {/* Left panel — topic list */}
      <aside className="w-64 flex-shrink-0 flex flex-col" style={{ background: 'var(--surface-raised)', borderRight: '1px solid var(--border-subtle)' }}>
        <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <p className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>{t('tenantHelp.title')}</p>
          <div className="relative">
            <svg className="absolute left-2.5 top-2.5" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-tertiary)' }}>
              <circle cx="7" cy="7" r="5"/><path d="m13 13-3-3"/>
            </svg>
            <input
              type="text"
              placeholder={t('tenantHelp.searchPlaceholder')}
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
              {t('tenantHelp.noResults', { query: search })}
            </p>
          )}
        </nav>
      </aside>

      {/* Right panel — article content */}
      <main className="flex-1 overflow-y-auto px-10 py-8">
        {activeArticle && <ArticleView article={activeArticle} />}
      </main>
    </div>
  )
}
