# Mailbox map

## Human-operated mailboxes

### support@myorbisvoice.com
Purpose:
- support replies
- inbound inquiries
- escalations
- customer-facing replies

### billing@myorbisvoice.com
Purpose:
- billing questions
- failed payment discussions
- invoice issues

### ops@myorbisvoice.com
Purpose:
- operational alerts
- internal maintenance notices
- provider notifications

### partners@myorbisvoice.com
Purpose:
- affiliate and partner communication
- partner onboarding
- commission questions

## Alias recommendations

- `hello@myorbisvoice.com` → support
- `sales@myorbisvoice.com` → support or partnerships
- `affiliates@myorbisvoice.com` → partners
- `admin@myorbisvoice.com` → ops

## Transactional sender identities

### auth@notify.myorbisvoice.com
Used for:
- verification
- login alerts
- password resets

### bookings@notify.myorbisvoice.com
Used for:
- appointment confirmations
- reminders
- alternative-time offers

### billing@notify.myorbisvoice.com
Used for:
- subscription receipts
- failed payment notices
- dunning sequences

### system@notify.myorbisvoice.com
Used for:
- workflow notices
- maintenance notices
- system-generated summaries

## Receiving email

### Human replies
These land in root-domain human mailboxes.

### Machine-parsed messages
If needed later, use dedicated inbound automation mailboxes or inbound parsing service addresses.

## Rules

1. Do not use a staff mailbox as the app’s default transactional sender.
2. Do not blend support mail reputation with bulk workflow mail.
3. Keep reply-to behavior explicit for every template type.
