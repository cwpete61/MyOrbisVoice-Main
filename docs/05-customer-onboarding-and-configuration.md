# Customer onboarding and configuration

## Onboarding objective

The customer onboarding flow must capture everything needed to configure the agents, channels, scheduling logic, and business behavior without exposing the raw complexity of n8n.

## Step-by-step onboarding

### Step 1 — Account creation
Capture:
- full name
- business name
- registration email
- password
- selected plan
- acceptance of terms

### Step 2 — Workspace profile
Capture:
- public business name
- legal business name if needed
- primary phone
- public email
- website
- address
- timezone
- business hours
- service regions
- logo and brand assets

### Step 3 — Business contact and Google mailbox
Capture:
- dedicated Gmail or Google Workspace address for agent operations
- confirmation that the customer controls this mailbox
- mailbox display name
- optional fallback booking notification address

Action:
- connect the mailbox through Google OAuth
- request only required scopes
- store token metadata and connection state

Important:
- do not use the registration email as an assumed agent mailbox
- do not store the raw Gmail password as a normal operating credential

### Step 4 — Business DNA
Capture:
- business summary
- core services
- pricing notes
- service exclusions
- target customer types
- frequently asked questions
- common objections
- preferred phrasing
- prohibited phrasing
- compliance notes
- escalation conditions
- lead qualification rules
- booking rules
- cancellation rules
- after-hours rules

### Step 5 — Client master prompt
Capture structured prompt sections:
- business identity
- tone and speaking style
- accuracy rules
- sales rules
- customer service rules
- appointment rules
- escalation rules
- compliance guardrails
- handoff rules

### Step 6 — Agent selection
Enable configured roles:
- Orchestrator
- Appointment
- Sales
- Customer Service
- Marketing
- Assistant
- Secretary

Each role gets:
- enabled state
- prompt block
- goal definition
- allowed actions
- handoff rules

### Step 7 — Channel activation
Customer chooses which channels to activate:
- website widget
- inbound receptionist
- outbound caller

Each channel includes:
- business hours behavior
- greeting rules
- fallback behavior
- routing rules
- escalation rules

### Step 8 — Telephony and SMS
If the plan allows it, configure:
- Twilio account linkage
- inbound number selection or assignment
- outbound caller identity
- SMS enabled status
- call forwarding numbers
- voicemail behavior

### Step 9 — Appointment setup
Configure:
- Google Calendar connection
- meeting duration rules
- appointment types
- working hours
- timezone
- buffers
- alternative time logic
- confirmation channels

### Step 10 — Go-live test
Run:
- sample widget conversation
- sample inbound call
- sample outbound call
- sample booking action
- sample confirmation email
- sample SMS confirmation if enabled
