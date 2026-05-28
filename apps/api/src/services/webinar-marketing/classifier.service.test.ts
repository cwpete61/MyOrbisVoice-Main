import { describe, it, expect } from 'vitest'
import {
  classifyEmail,
  isDisposableDomain,
  isFreeMailDomain,
  isSuppressedRole,
  isAllowedBusinessRole,
} from './classifier.service.js'

describe('classifyEmail', () => {
  describe('INVALID_FORMAT', () => {
    it('rejects empty string', () => {
      expect(classifyEmail({ normalizedEmail: '' }).emailType).toBe('INVALID_FORMAT')
    })
    it('rejects missing @', () => {
      expect(classifyEmail({ normalizedEmail: 'foo.bar.com' }).emailType).toBe('INVALID_FORMAT')
    })
    it('rejects missing localpart', () => {
      expect(classifyEmail({ normalizedEmail: '@example.com' }).emailType).toBe('INVALID_FORMAT')
    })
    it('rejects missing tld', () => {
      expect(classifyEmail({ normalizedEmail: 'foo@bar' }).emailType).toBe('INVALID_FORMAT')
    })
  })

  describe('DISPOSABLE_DOMAIN', () => {
    it('flags mailinator.com', () => {
      expect(classifyEmail({ normalizedEmail: 'a@mailinator.com' }).emailType).toBe('DISPOSABLE_DOMAIN')
    })
    it('flags 10minutemail.com', () => {
      expect(classifyEmail({ normalizedEmail: 'a@10minutemail.com' }).emailType).toBe('DISPOSABLE_DOMAIN')
    })
    it('flags yopmail.com', () => {
      expect(classifyEmail({ normalizedEmail: 'patient@yopmail.com' }).emailType).toBe('DISPOSABLE_DOMAIN')
    })
    it('beats suppressed-role check (disposable takes priority)', () => {
      // noreply@mailinator.com is disposable first, suppressed-role second.
      // Either is rejection, but ordering matters for accurate audit.
      expect(classifyEmail({ normalizedEmail: 'noreply@mailinator.com' }).emailType).toBe('DISPOSABLE_DOMAIN')
    })
  })

  describe('NO_REPLY_OR_SUPPRESSED', () => {
    it('flags noreply@', () => {
      expect(classifyEmail({ normalizedEmail: 'noreply@biz.com' }).emailType).toBe('NO_REPLY_OR_SUPPRESSED')
    })
    it('flags no-reply@ (hyphenated)', () => {
      expect(classifyEmail({ normalizedEmail: 'no-reply@biz.com' }).emailType).toBe('NO_REPLY_OR_SUPPRESSED')
    })
    it('flags donotreply@', () => {
      expect(classifyEmail({ normalizedEmail: 'donotreply@biz.com' }).emailType).toBe('NO_REPLY_OR_SUPPRESSED')
    })
    it('flags abuse@, postmaster@, privacy@, legal@, security@', () => {
      const prefixes = ['abuse', 'postmaster', 'privacy', 'legal', 'security']
      for (const p of prefixes) {
        expect(classifyEmail({ normalizedEmail: `${p}@biz.com` }).emailType).toBe('NO_REPLY_OR_SUPPRESSED')
      }
    })
  })

  describe('PERSONAL_FREE_MAIL', () => {
    it('flags gmail.com', () => {
      expect(classifyEmail({ normalizedEmail: 'jane@gmail.com' }).emailType).toBe('PERSONAL_FREE_MAIL')
    })
    it('flags yahoo.com + outlook.com + icloud.com', () => {
      expect(classifyEmail({ normalizedEmail: 'a@yahoo.com' }).emailType).toBe('PERSONAL_FREE_MAIL')
      expect(classifyEmail({ normalizedEmail: 'a@outlook.com' }).emailType).toBe('PERSONAL_FREE_MAIL')
      expect(classifyEmail({ normalizedEmail: 'a@icloud.com' }).emailType).toBe('PERSONAL_FREE_MAIL')
    })
    it('flags protonmail and proton.me', () => {
      expect(classifyEmail({ normalizedEmail: 'a@protonmail.com' }).emailType).toBe('PERSONAL_FREE_MAIL')
      expect(classifyEmail({ normalizedEmail: 'a@proton.me' }).emailType).toBe('PERSONAL_FREE_MAIL')
    })
    it('quarantines even with allowed business prefix', () => {
      // info@gmail.com — prefix would normally allow, but free-mail domain
      // forces quarantine for manual review per project rule.
      expect(classifyEmail({ normalizedEmail: 'info@gmail.com' }).emailType).toBe('PERSONAL_FREE_MAIL')
    })
  })

  describe('ROLE_BASED_BUSINESS', () => {
    it('flags info@, contact@, office@, hello@', () => {
      for (const p of ['info', 'contact', 'office', 'hello']) {
        const r = classifyEmail({ normalizedEmail: `${p}@biz.com` })
        expect(r.emailType).toBe('ROLE_BASED_BUSINESS')
        expect(r.localPart).toBe(p)
      }
    })
    it('flags appointments@, scheduling@, reception@, events@, marketing@', () => {
      for (const p of ['appointments', 'scheduling', 'reception', 'events', 'marketing']) {
        expect(classifyEmail({ normalizedEmail: `${p}@biz.com` }).emailType).toBe('ROLE_BASED_BUSINESS')
      }
    })
  })

  describe('BUSINESS_DOMAIN', () => {
    it('flags arbitrary localpart on business domain', () => {
      expect(classifyEmail({ normalizedEmail: 'john@dentalclinic.com' }).emailType).toBe('BUSINESS_DOMAIN')
    })
    it('support@ defaults to BUSINESS_DOMAIN (not in allowed list)', () => {
      // support@ is intentionally not in ALLOWED_BUSINESS_ROLES; ends up
      // as BUSINESS_DOMAIN catch-all so promotion gate can still consider it.
      expect(classifyEmail({ normalizedEmail: 'support@biz.com' }).emailType).toBe('BUSINESS_DOMAIN')
    })
    it('handles uppercase + whitespace input', () => {
      const r = classifyEmail({ normalizedEmail: '  John.Doe@Example.COM  ' })
      expect(r.emailType).toBe('BUSINESS_DOMAIN')
      expect(r.domain).toBe('example.com')
      expect(r.localPart).toBe('john.doe')
    })
  })

  describe('classification output shape', () => {
    it('always includes localPart, domain, reason', () => {
      const r = classifyEmail({ normalizedEmail: 'a@b.com' })
      expect(r.localPart).toBe('a')
      expect(r.domain).toBe('b.com')
      expect(typeof r.reason).toBe('string')
      expect(r.reason.length).toBeGreaterThan(0)
    })
    it('blank localPart + domain on invalid input', () => {
      const r = classifyEmail({ normalizedEmail: 'garbage' })
      expect(r.localPart).toBe('')
      expect(r.domain).toBe('')
    })
  })
})

describe('module-level helpers', () => {
  it('isDisposableDomain', () => {
    expect(isDisposableDomain('mailinator.com')).toBe(true)
    expect(isDisposableDomain('MailInator.com')).toBe(true)
    expect(isDisposableDomain('example.com')).toBe(false)
  })
  it('isFreeMailDomain', () => {
    expect(isFreeMailDomain('gmail.com')).toBe(true)
    expect(isFreeMailDomain('Yahoo.com')).toBe(true)
    expect(isFreeMailDomain('biz.com')).toBe(false)
  })
  it('isSuppressedRole', () => {
    expect(isSuppressedRole('noreply')).toBe(true)
    expect(isSuppressedRole('NoReply')).toBe(true)
    expect(isSuppressedRole('info')).toBe(false)
  })
  it('isAllowedBusinessRole', () => {
    expect(isAllowedBusinessRole('info')).toBe(true)
    expect(isAllowedBusinessRole('CONTACT')).toBe(true)
    expect(isAllowedBusinessRole('john')).toBe(false)
  })
})
