'use client'

import React from 'react'

/**
 * Minimal markdown renderer for the partner Affiliate Agreement. The repo has
 * no markdown dependency and the agreement text is fixed/trusted (it ships in
 * the bundle, never user input), so a tiny purpose-built parser is leaner than
 * pulling in react-markdown. Supports exactly what the agreement uses:
 *   #/##/###/#### headings · --- horizontal rule · > blockquote ·
 *   "* " list items · **bold** inline · blank-line-separated paragraphs.
 */

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  // Split on **bold** spans, keeping the delimited content.
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${keyBase}-b${i}`}>{part.slice(2, -2)}</strong>
    }
    return <React.Fragment key={`${keyBase}-t${i}`}>{part}</React.Fragment>
  })
}

export function AgreementBody({ markdown }: { markdown: string }) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: React.ReactNode[] = []
  let para: string[] = []
  let list: string[] = []
  let key = 0

  const flushPara = () => {
    if (para.length) {
      const text = para.join(' ').trim()
      if (text) blocks.push(<p key={`p${key++}`} style={{ margin: '0 0 0.85rem', lineHeight: 1.65 }}>{renderInline(text, `p${key}`)}</p>)
      para = []
    }
  }
  const flushList = () => {
    if (list.length) {
      blocks.push(
        <ul key={`ul${key++}`} style={{ margin: '0 0 0.85rem 1.1rem', listStyle: 'disc', lineHeight: 1.6 }}>
          {list.map((li, i) => <li key={i} style={{ marginBottom: '0.35rem' }}>{renderInline(li, `li${key}-${i}`)}</li>)}
        </ul>,
      )
      list = []
    }
  }
  const flushAll = () => { flushPara(); flushList() }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) { flushAll(); continue }

    if (line.startsWith('#### ')) {
      flushAll()
      blocks.push(<h4 key={`h${key++}`} style={{ fontSize: '0.95rem', fontWeight: 700, margin: '1.1rem 0 0.5rem', color: 'var(--text-primary)' }}>{renderInline(line.slice(5), `h${key}`)}</h4>)
    } else if (line.startsWith('### ')) {
      flushAll()
      blocks.push(<h3 key={`h${key++}`} style={{ fontSize: '1.05rem', fontWeight: 700, margin: '1.3rem 0 0.55rem', color: 'var(--text-primary)' }}>{renderInline(line.slice(4), `h${key}`)}</h3>)
    } else if (line.startsWith('## ')) {
      flushAll()
      blocks.push(<h2 key={`h${key++}`} style={{ fontSize: '1.2rem', fontWeight: 800, margin: '1.7rem 0 0.7rem', color: 'var(--text-primary)' }}>{renderInline(line.slice(3), `h${key}`)}</h2>)
    } else if (line.startsWith('# ')) {
      flushAll()
      blocks.push(<h1 key={`h${key++}`} style={{ fontSize: '1.45rem', fontWeight: 800, margin: '0 0 0.9rem', color: 'var(--text-primary)' }}>{renderInline(line.slice(2), `h${key}`)}</h1>)
    } else if (line.trim() === '---') {
      flushAll()
      blocks.push(<hr key={`hr${key++}`} style={{ border: 0, borderTop: '1px solid var(--border-subtle)', margin: '1.4rem 0' }} />)
    } else if (line.startsWith('> ')) {
      flushAll()
      blocks.push(
        <blockquote key={`bq${key++}`} style={{ margin: '0 0 0.85rem', padding: '0.6rem 0.9rem', borderLeft: '3px solid oklch(55% 0.11 193)', background: 'oklch(55% 0.11 193 / 0.07)', borderRadius: 6, lineHeight: 1.6, fontStyle: 'italic' }}>
          {renderInline(line.slice(2), `bq${key}`)}
        </blockquote>,
      )
    } else if (/^\*\s/.test(line.trim())) {
      flushPara()
      list.push(line.trim().replace(/^\*\s/, ''))
    } else {
      flushList()
      para.push(line.trim())
    }
  }
  flushAll()

  return <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{blocks}</div>
}
