# E2E Capture Users

Two seeded users on **prod** specifically for running `pnpm capture-screenshots`
against live URLs. Created 2026-05-14. Safe to keep — no real Stripe customer,
no real Twilio number, just enough fixtures for the partner-portal pages to
render their full UI states.

## Credentials

| User | Email | Password | Role |
|---|---|---|---|
| Capture Bot (partner) | `e2e-capture@myorbisvoice.com` | `CaptureBot!2026` | `partner` on orbis-platform tenant |
| Capture Admin | `e2e-capture-admin@myorbisvoice.com` | `CaptureBot!2026` | `platform_super_admin` on orbis-platform tenant |

Password hash (bcrypt rounds=10): `$2a$10$AkUBnp4dYCmaMiHxSKMr1u1h8mmZk3yNW2oz5sCzCNioOlQDOIXIe`

## Seeded fixtures

- `User` row for each
- `TenantMember` row binding to `orbis-platform` tenant + correct `RoleDefinition`
- `AffiliateAccount` for capture-bot:
  - `slug=e2e.capture`, `displayName=Capture Bot`, `businessName=Capture Bot Demo Co`
  - `status=ACTIVE`, `partnerPageActive=true`
- `PhoneNumber` for capture-bot:
  - `e164Number=+12125551234` (fake — never registered with Twilio)
  - `purchaseStatus=PURCHASED`, `partnerCapabilityTier=VOICE`
  - `twilioNumberSid=PN-FAKE-CAPTURE-001`, `stripeSubscriptionId=sub_fake_capture_001`
  - Makes the Active Numbers table render a row + makes the admin Number Requests / PURCHASED tab show one row with the Disable button

## Running captures

```bash
APP_BASE_URL=https://app.myorbisvoice.com \
E2E_TENANT_LOGIN_EMAIL=e2e-capture@myorbisvoice.com \
E2E_TENANT_LOGIN_PASSWORD='CaptureBot!2026' \
E2E_ADMIN_LOGIN_EMAIL=e2e-capture-admin@myorbisvoice.com \
E2E_ADMIN_LOGIN_PASSWORD='CaptureBot!2026' \
pnpm capture-screenshots --partner
```

PNGs land in `apps/web/public/help-screenshots/`. Commit + `./infrastructure/scripts/deploy.sh web` to push.

## Teardown (when no longer needed)

```sql
BEGIN;
DELETE FROM "PhoneNumber"        WHERE id = 'e2e-capture-pn-0000000000000001';
DELETE FROM "AffiliateAccount"   WHERE id = 'e2e-capture-aff-0000000000000001';
DELETE FROM "TenantMember"       WHERE id IN ('e2e-capture-tm-000000000000000001', 'e2e-capture-admin-tm-00000000001');
DELETE FROM "User"               WHERE id IN ('e2e-capture-user-0000000000000001', 'e2e-capture-admin-000000000000001');
COMMIT;
```

Keep the users around as long as the partner-portal UI keeps evolving — re-captures need them.
