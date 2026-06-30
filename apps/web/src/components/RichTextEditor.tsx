'use client'

import { useEffect, useRef } from 'react'
import { useT } from '@/lib/i18n/I18nProvider'

/**
 * Lightweight rich-text editor for partner Compose. Uses contentEditable +
 * document.execCommand for inline formatting. No external library — fits the
 * project's "no UI library" pattern. Yes, execCommand is deprecated; it still
 * works in every browser circa 2026 and is the smallest-footprint option. Will
 * migrate to Selection/Range API in Phase C.7 if browser support degrades.
 *
 * Value contract: `value` is the rendered HTML string. `onChange` fires on
 * every input event with the editor's current innerHTML. The parent component
 * owns the state.
 *
 * Behavior:
 *   - Toolbar: Bold, Italic, Link, Bullet list, Ordered list, Clear formatting
 *   - `value` prop pushes into the editor ONLY when it differs from the
 *     current innerHTML, to avoid clobbering cursor position on each keystroke
 *   - Empty-state placeholder rendered via CSS `:empty::before` (escaped)
 *   - All formatting happens inline — no paragraph wrapping forced; pressing
 *     Enter inserts `<div><br></div>` (browser default), which the receiving
 *     mail clients render correctly.
 */
export function RichTextEditor({ value, onChange, placeholder }: {
  value:       string
  onChange:    (html: string) => void
  placeholder?: string
}) {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)

  // Sync `value` -> editor innerHTML when the parent updates from outside
  // (e.g. picking a template), but NOT on every onInput round-trip.
  useEffect(() => {
    if (!ref.current) return
    if (ref.current.innerHTML !== value) {
      ref.current.innerHTML = value
    }
  }, [value])

  function emit() {
    if (ref.current) onChange(ref.current.innerHTML)
  }

  function format(command: string, arg?: string) {
    ref.current?.focus()
    document.execCommand(command, false, arg)
    emit()
  }

  function insertLink() {
    const url = window.prompt(t('partnerMailbox.compose.editor.linkPrompt'), 'https://')
    if (!url) return
    // execCommand('createLink') wraps the selection; if nothing's selected the
    // result is a no-op. Caller can paste the URL as visible text first.
    format('createLink', url)
  }

  // Sanitize pasted content. Pasted HTML from Word / Google Docs / web pages
  // carries inline styles + absolute positioning that overlap and render
  // unreadable. We strip all styling and keep only a small allowlist of block /
  // inline tags, so what you paste matches what we store (the API sanitizes the
  // same set on save). Falls back to plain text when no HTML is on the clipboard.
  function onPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault()
    const html = e.clipboardData.getData('text/html')
    const text = e.clipboardData.getData('text/plain')
    if (html) document.execCommand('insertHTML', false, sanitizePastedHtml(html))
    else document.execCommand('insertText', false, text)
    emit()
  }

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-app)' }}
    >
      <div
        className="flex items-center gap-1 px-2 py-1.5 text-xs"
        style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-raised)' }}
      >
        <ToolbarButton onClick={() => format('bold')}            title={t('partnerMailbox.compose.editor.bold')}><b>B</b></ToolbarButton>
        <ToolbarButton onClick={() => format('italic')}          title={t('partnerMailbox.compose.editor.italic')}><i>I</i></ToolbarButton>
        <ToolbarButton onClick={() => format('underline')}       title={t('partnerMailbox.compose.editor.underline')}><u>U</u></ToolbarButton>
        <Divider />
        <ToolbarButton onClick={() => format('formatBlock', 'P')}  title={t('partnerMailbox.compose.editor.paragraph')}>¶</ToolbarButton>
        <ToolbarButton onClick={() => format('formatBlock', 'H2')} title={t('partnerMailbox.compose.editor.heading')}>H1</ToolbarButton>
        <ToolbarButton onClick={() => format('formatBlock', 'H3')} title={t('partnerMailbox.compose.editor.subheading')}>H2</ToolbarButton>
        <Divider />
        <ToolbarButton onClick={() => format('insertUnorderedList')} title={t('partnerMailbox.compose.editor.bulletList')}>&bull;</ToolbarButton>
        <ToolbarButton onClick={() => format('insertOrderedList')}   title={t('partnerMailbox.compose.editor.orderedList')}>1.</ToolbarButton>
        <Divider />
        <ToolbarButton onClick={() => format('justifyLeft')}     title={t('partnerMailbox.compose.editor.alignLeft')}>⬅</ToolbarButton>
        <ToolbarButton onClick={() => format('justifyCenter')}   title={t('partnerMailbox.compose.editor.alignCenter')}>↔</ToolbarButton>
        <ToolbarButton onClick={() => format('justifyRight')}    title={t('partnerMailbox.compose.editor.alignRight')}>➡</ToolbarButton>
        <Divider />
        <ToolbarButton onClick={insertLink}                      title={t('partnerMailbox.compose.editor.link')}>🔗&nbsp;{t('partnerMailbox.compose.editor.linkLabel')}</ToolbarButton>
        <ToolbarButton onClick={() => format('removeFormat')}    title={t('partnerMailbox.compose.editor.clearFormatting')}>{t('partnerMailbox.compose.editor.clearLabel')}</ToolbarButton>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onPaste={onPaste}
        data-placeholder={placeholder ?? ''}
        className="rich-editor-area px-3 py-2 text-sm"
        style={{ minHeight: 240, outline: 'none', color: 'var(--text-primary)' }}
      />
    </div>
  )
}

function ToolbarButton({ onClick, title, children }: {
  onClick:  () => void
  title:    string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="px-2 py-1 rounded transition-colors hover:opacity-100"
      style={{ color: 'var(--text-secondary)', background: 'transparent', opacity: 0.85 }}
      onMouseDown={(e) => e.preventDefault()}  // keep editor selection on click
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="mx-0.5" style={{ width: 1, height: 18, background: 'var(--border-subtle)', display: 'inline-block' }} />
}

// Client-side paste sanitizer. Strips every attribute (so inline styles +
// absolute positioning that caused overlapping text are gone) and keeps only a
// small allowlist of tags; disallowed tags are unwrapped (content kept). Mirrors
// the API's server-side allowlist so paste == what gets stored.
const PASTE_ALLOWED = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI', 'H2', 'H3', 'BLOCKQUOTE', 'A', 'SPAN', 'DIV'])

function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function escText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function sanitizePastedHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const walk = (node: Node): string => {
    let out = ''
    node.childNodes.forEach((child) => {
      if (child.nodeType === 3 /* text */) { out += escText(child.textContent ?? ''); return }
      if (child.nodeType !== 1 /* element */) return
      const el = child as Element
      const tag = el.tagName.toUpperCase()
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'IFRAME') return
      const inner = walk(el)
      if (!PASTE_ALLOWED.has(tag)) { out += inner; return } // unwrap unknown tag, keep text
      if (tag === 'BR') { out += '<br>'; return }
      if (tag === 'A') {
        const href = (el.getAttribute('href') ?? '').trim()
        const safe = /^(https?:|mailto:|tel:|#|\/)/i.test(href) && !/^javascript:/i.test(href)
        out += safe ? `<a href="${escAttr(href)}">${inner}</a>` : inner
        return
      }
      const name = tag.toLowerCase()
      out += `<${name}>${inner}</${name}>`
    })
    return out
  }
  return walk(doc.body)
}
