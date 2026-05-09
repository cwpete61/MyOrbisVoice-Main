// Password complexity rules — applied uniformly at every password-set path:
// signup (regular + affiliate + Google-finish-profile), change-password,
// reset-password, set-password (Google-only users adding a local password).
//
// Rule set (established 2026-05-09 per platform owner):
//   - minimum 8 characters
//   - at least 1 number
//   - at least 1 capital letter
//   - at least 1 symbol (anything non-alphanumeric)
//
// Mirrored client-side at apps/web/src/lib/passwordRules.ts so the signup
// form can render live pass/fail indicators. The backend is the source of
// truth — even if a client bypasses validation, the server rejects with
// VALIDATION_ERROR.

import { z } from 'zod'

export interface PasswordRule {
  id:      string
  test:    (s: string) => boolean
  message: string  // user-facing label, e.g. "at least 8 characters"
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length',  test: (s) => s.length >= 8,           message: 'at least 8 characters' },
  { id: 'capital', test: (s) => /[A-Z]/.test(s),         message: 'one capital letter' },
  { id: 'number',  test: (s) => /[0-9]/.test(s),         message: 'one number' },
  { id: 'symbol',  test: (s) => /[^A-Za-z0-9]/.test(s),  message: 'one symbol (e.g. ! @ # $ %)' },
]

/** Zod schema enforcing all password rules. Aggregates failures into a single
 *  combined message so the form can display the full requirement list at once
 *  rather than one rule per round-trip. */
export const passwordSchema = z.string().superRefine((val, ctx) => {
  const failed = PASSWORD_RULES.filter((r) => !r.test(val)).map((r) => r.message)
  if (failed.length > 0) {
    ctx.addIssue({
      code:    z.ZodIssueCode.custom,
      message: 'Password must include ' + failed.join(', ') + '.',
    })
  }
})

/** Programmatic check (returns the failing rules; empty array = ok).
 *  Used by service-layer callers that don't run zod validation, e.g. when
 *  an admin sets a password directly. */
export function checkPasswordComplexity(password: string): PasswordRule[] {
  return PASSWORD_RULES.filter((r) => !r.test(password))
}
