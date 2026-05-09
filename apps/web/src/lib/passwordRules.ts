// Mirror of apps/api/src/lib/password-rules.ts so signup forms can render
// live pass/fail indicators as the user types. The backend remains the
// authority — even if the client bypasses validation, the server rejects
// non-compliant passwords with a 422 VALIDATION_ERROR.

export interface PasswordRule {
  id:      'length' | 'capital' | 'number' | 'symbol'
  test:    (s: string) => boolean
  labelKey: string  // i18n key — e.g. 'passwordRules.length'
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length',  test: (s) => s.length >= 8,           labelKey: 'passwordRules.length' },
  { id: 'capital', test: (s) => /[A-Z]/.test(s),         labelKey: 'passwordRules.capital' },
  { id: 'number',  test: (s) => /[0-9]/.test(s),         labelKey: 'passwordRules.number' },
  { id: 'symbol',  test: (s) => /[^A-Za-z0-9]/.test(s),  labelKey: 'passwordRules.symbol' },
]

/** Returns true when all rules pass. Used for enabling/disabling submit
 *  buttons. */
export function isPasswordValid(password: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(password))
}

/** Returns the rule results — { id, ok } for each rule. Used by the
 *  PasswordRulesChecklist component to render green/grey indicators. */
export function evaluatePassword(password: string): Array<{ id: PasswordRule['id']; ok: boolean; labelKey: string }> {
  return PASSWORD_RULES.map((r) => ({ id: r.id, ok: r.test(password), labelKey: r.labelKey }))
}
