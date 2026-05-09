'use client'

import { useT } from '@/lib/i18n/I18nProvider'
import { evaluatePassword } from '@/lib/passwordRules'

// Live pass/fail checklist rendered under the password input on signup +
// change-password + reset-password forms. Shows the four complexity rules
// with a green check when satisfied, grey dot when not. Empty input shows
// all rules in grey.
//
// Mirror of apps/api/src/lib/password-rules.ts — backend still validates.

export function PasswordRulesChecklist({ value }: { value: string }) {
  const t = useT()
  const results = evaluatePassword(value)
  const empty = value.length === 0

  return (
    <ul className="text-[11px] mt-1.5 space-y-0.5" style={{ color: 'var(--text-tertiary)' }}>
      {results.map((r) => {
        const ok = r.ok && !empty
        return (
          <li key={r.id} className="flex items-center gap-1.5">
            <span
              className="inline-flex items-center justify-center flex-shrink-0"
              style={{
                width: 12, height: 12,
                color: ok ? 'oklch(55% 0.18 145)' : 'var(--text-tertiary)',
              }}
              aria-hidden="true"
            >
              {ok ? (
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 6l3 3 5-6" />
                </svg>
              ) : (
                <span style={{ width: 4, height: 4, borderRadius: 999, background: 'currentColor', opacity: 0.5 }} />
              )}
            </span>
            <span style={{ color: ok ? 'oklch(55% 0.18 145)' : 'var(--text-tertiary)' }}>
              {t(r.labelKey)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
