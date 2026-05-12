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
        <Divider />
        <ToolbarButton onClick={() => format('insertUnorderedList')} title={t('partnerMailbox.compose.editor.bulletList')}>&bull;</ToolbarButton>
        <ToolbarButton onClick={() => format('insertOrderedList')}   title={t('partnerMailbox.compose.editor.orderedList')}>1.</ToolbarButton>
        <Divider />
        <ToolbarButton onClick={insertLink}                      title={t('partnerMailbox.compose.editor.link')}>🔗&nbsp;{t('partnerMailbox.compose.editor.linkLabel')}</ToolbarButton>
        <ToolbarButton onClick={() => format('removeFormat')}    title={t('partnerMailbox.compose.editor.clearFormatting')}>{t('partnerMailbox.compose.editor.clearLabel')}</ToolbarButton>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
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
