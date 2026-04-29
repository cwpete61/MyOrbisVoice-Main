# Infrastructure and communications architecture

## Hosting split

### Spaceship
Used for:
- public marketing website hosting
- standard company mailboxes
- optional documentation or brochure pages

### Contabo
Used for:
- app runtime
- backend API
- voice gateway
- n8n
- PostgreSQL
- Redis
- reverse proxy
- worker services
- monitoring utilities

## Communications channels

VoiceAutomation communicates through:

1. browser widget voice
2. inbound phone calls
3. outbound phone calls
4. SMS
5. transactional email
6. human mailbox email

## Channel ownership

### Browser widget voice
Owned by the voice gateway and app backend.

### Inbound and outbound calling
Owned by Twilio plus the voice gateway.

### SMS
Owned by Twilio and workflow automation.

### Transactional email
Owned by a dedicated transactional provider using a separate sending subdomain.

### Human mailbox email
Owned by Spacemail on the root business domain.

## Recommended mail split

### Human mailboxes on root domain
Examples:
- `support@myorbisvoice.com`
- `billing@myorbisvoice.com`
- `ops@myorbisvoice.com`
- `partners@myorbisvoice.com`

### Transactional mail on sending subdomain
Examples:
- `auth@notify.myorbisvoice.com`
- `bookings@notify.myorbisvoice.com`
- `billing@notify.myorbisvoice.com`
- `system@notify.myorbisvoice.com`

## High-level request flow examples

### Appointment booking from widget
1. website visitor starts widget session
2. voice gateway opens real-time session
3. agent determines appointment intent
4. backend checks tenant permissions and connected Google state
5. backend dispatches booking action
6. n8n workflow handles confirmation sequence
7. email and optional SMS confirmation are sent
8. audit event and reporting event are stored

### Inbound receptionist flow
1. Twilio sends inbound webhook
2. voice gateway accepts session
3. agent handles call using tenant Business DNA and role prompt
4. if transfer needed, call forwarding or live transfer executes
5. transcript, summary, lead or appointment events are posted to backend
6. backend triggers n8n workflows as needed

### Outbound campaign flow
1. tenant schedules campaign
2. app stores campaign rules and eligible contacts
3. n8n prepares call jobs
4. Twilio places outbound call
5. voice gateway manages live session
6. results flow back into backend and reporting
7. optional follow-up SMS or email is triggered
