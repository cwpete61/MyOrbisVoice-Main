'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiFetch } from '@/hooks/useApi'
import { useT } from '@/lib/i18n/I18nProvider'
import { MailboxHeader } from '@/components/MailboxHeader'
import { RichTextEditor } from '@/components/RichTextEditor'

type Template = {
  id:          string
  category:    string
  name:        string
  description: string | null
  subject:     string
  bodyHtml:    string
  isSystem:    boolean
  sortOrder:   number
}

type PartnerSummary = {
  partner: {
    slug:           string | null
    displayName:    string | null
    businessName:   string | null
    emailSignature: string | null
    partnerEmail:   string | null
  }
  user: { firstName: string | null; lastName: string | null }
}

// Strip HTML to plain text for the multipart text/plain fallback and to
// detect "blank message" (contentEditable can leave residual <br>/<div><br></div>).
function stripHtmlTags(html: string): string {
  if (typeof window === 'undefined') return html
  const div = document.createElement('div')
  const normalized = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
  div.innerHTML = normalized
  return (div.textContent || '').trim().replace(/\n{3,}/g, '\n\n')
}

function substituteVariables(template: string, partner: PartnerSummary | null): string {
  if (!partner) return template
  const firstName = partner.partner.displayName?.split(' ')[0]
                  ?? partner.user.firstName
                  ?? ''
  const replacements: Record<string, string> = {
    '{{partner.firstName}}':    firstName,
    '{{partner.displayName}}':  partner.partner.displayName    ?? '',
    '{{partner.businessName}}': partner.partner.businessName   ?? '',
    '{{partner.signature}}':    partner.partner.emailSignature ?? '',
    '{{partner.partnerEmail}}': partner.partner.partnerEmail   ?? '',
  }
  let out = template
  for (const [key, val] of Object.entries(replacements)) {
    out = out.split(key).join(val)
  }
  return out
}

export default function PartnerComposePage() {
  const t = useT()
  const router = useRouter()
  const params = useSearchParams()

  const [to, setTo]             = useState(params.get('to') ?? '')
  const [subject, setSubject]   = useState(params.get('subject') ?? '')
  const [body, setBody]         = useState(params.get('body') ?? '')
  const [sending, setSending]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [partnerSummary, setPartnerSummary] = useState<PartnerSummary | null>(null)
  const [selectedTpl, setSelectedTpl] = useState<string>('')
  // Live signature preview — same HTML that will be appended to this email
  // at send time. Pulled once on mount; shown read-only above the Send button
  // so the partner sees what their recipient will see.
  const [signatureHtml, setSignatureHtml] = useState<string>('')

  const inReplyTo = params.get('inReplyTo') ?? undefined
  const threadId  = params.get('threadId')  ?? undefined

  useEffect(() => {
    Promise.all([
      apiFetch<{ templates: Template[] }>('/api/partner/mailbox/templates').catch(() => ({ templates: [] })),
      apiFetch<PartnerSummary>('/api/partner/me').catch(() => null),
      apiFetch<{ html: string; source: 'auto' | 'custom' }>('/api/partner/signature-preview').catch(() => null),
    ]).then(([tpl, me, sig]) => {
      setTemplates(tpl.templates ?? [])
      setPartnerSummary(me)
      setSignatureHtml(sig?.html ?? '')
    })
  }, [])

  function insertTemplate(templateId: string) {
    setSelectedTpl(templateId)
    if (!templateId) return
    const tpl = templates.find(t => t.id === templateId)
    if (!tpl) return
    setSubject(substituteVariables(tpl.subject, partnerSummary))
    setBody(substituteVariables(tpl.bodyHtml, partnerSummary))
  }

  async function send() {
    setError(null)
    const bodyText = stripHtmlTags(body).trim()
    if (!to.trim() || !subject.trim() || !bodyText) {
      setError(t('partnerMailbox.compose.fillAllRequired'))
      return
    }
    setSending(true)
    try {
      await apiFetch('/api/partner/mailbox/compose', {
        method: 'POST',
        body: JSON.stringify({
          to:      to.trim(),
          subject: subject.trim(),
          html:    body,
          text:    bodyText,
          ...(inReplyTo ? { inReplyTo } : {}),
          ...(threadId  ? { threadId  } : {}),
        }),
      })
      router.push('/partner-portal/mailbox/sent')
    } catch (e: unknown) {
      setError((e as Error).message ?? t('partnerMailbox.compose.sendFailed'))
    } finally {
      setSending(false)
    }
  }

  // Group templates by category for nicer dropdown rendering
  const groupedTemplates = templates.reduce<Record<string, Template[]>>((acc, tpl) => {
    (acc[tpl.category] = acc[tpl.category] ?? []).push(tpl)
    return acc
  }, {})

  return (
    <div className="max-w-2xl">
      <MailboxHeader active="compose" />

      <div className="rounded-xl p-5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        {templates.length > 0 && (
          <div className="mb-4">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              {t('partnerMailbox.compose.templateLabel')}
            </label>
            <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
              {t('partnerMailbox.compose.templateHelp')}
            </p>
            <select
              value={selectedTpl}
              onChange={e => insertTemplate(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            >
              <option value="">{t('partnerMailbox.compose.templateNone')}</option>
              {Object.entries(groupedTemplates).map(([category, items]) => (
                <optgroup key={category} label={t(`partnerMailbox.compose.templateCategory.${category}`)}>
                  {items.map(tpl => (
                    <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        )}

        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('partnerMailbox.compose.toLabel')}</label>
        <input
          type="email"
          value={to}
          onChange={e => setTo(e.target.value)}
          placeholder={t('partnerMailbox.compose.toPlaceholder')}
          className="w-full rounded-lg px-3 py-2 text-sm mb-4"
          style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
        />

        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('partnerMailbox.compose.subjectLabel')}</label>
        <input
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder={t('partnerMailbox.compose.subjectPlaceholder')}
          className="w-full rounded-lg px-3 py-2 text-sm mb-4"
          style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
        />

        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('partnerMailbox.compose.bodyLabel')}</label>
        <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>{t('partnerMailbox.compose.bodyHelp')}</p>
        <div className="mb-4">
          <RichTextEditor
            value={body}
            onChange={setBody}
            placeholder={t('partnerMailbox.compose.bodyPlaceholder')}
          />
        </div>

        {/* Signature preview — exact HTML that will be appended below your
            body when sent. Read-only (edit at Profile → Email setup). */}
        {signatureHtml && (
          <div className="mb-4">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              {t('partnerMailbox.compose.signatureLabel')}
            </label>
            <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
              {t('partnerMailbox.compose.signatureHelp')}
            </p>
            <iframe
              title={t('partnerMailbox.compose.signatureLabel')}
              srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:12px;background:transparent;font-family:Arial,Helvetica,sans-serif;color:#222;}</style></head><body>${signatureHtml}</body></html>`}
              style={{
                width: '100%',
                minHeight: 140,
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                background: 'white',
              }}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
            />
          </div>
        )}

        {error && <p className="text-xs mb-3" style={{ color: 'oklch(60% 0.2 30)' }}>{error}</p>}

        <div className="flex items-center gap-3">
          <button
            onClick={send}
            disabled={sending}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--brand-500)', color: '#fff', opacity: sending ? 0.6 : 1 }}
          >
            {sending ? t('partnerMailbox.compose.sending') : t('partnerMailbox.compose.send')}
          </button>
          <button
            onClick={() => router.push('/partner-portal/mailbox')}
            disabled={sending}
            className="px-4 py-2 rounded-lg text-xs"
            style={{ background: 'var(--surface-app)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
          >
            {t('partnerMailbox.compose.cancel')}
          </button>
        </div>
      </div>

      <p className="text-xs mt-3" style={{ color: 'var(--text-tertiary)' }}>
        {t('partnerMailbox.compose.signatureNote')}
      </p>
    </div>
  )
}
