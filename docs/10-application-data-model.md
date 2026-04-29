# Application data model

## Core tables

### users
Stores user identities.

### tenants
Stores workspace records.

### tenant_members
Maps users to tenants and roles.

### roles
Stores role definitions.

### plans
Stores plan definitions.

### entitlements
Stores possible features and quota definitions.

### tenant_entitlements
Stores effective tenant-level entitlement values.

### business_profiles
Stores company profile data.

### business_dna
Stores structured tenant business knowledge.

### prompt_versions
Stores versioned prompt content.

### agents
Stores enabled role agents and settings.

### channels
Stores widget, inbound, and outbound channel configs.

### google_connections
Stores Google account integration metadata.

### twilio_connections
Stores telephony integration metadata.

### stripe_customers
Stores billing linkage.

### subscriptions
Stores active and historical subscription state.

### phone_numbers
Stores provisioned phone numbers and routing flags.

### appointments
Stores booking records and external IDs.

### contacts
Stores leads and customers.

### conversations
Stores session-level records.

### call_logs
Stores call metadata.

### message_logs
Stores SMS and email metadata.

### workflow_runs
Stores app-level workflow references.

### affiliate_accounts
Stores affiliate identities and payout metadata.

### affiliate_clicks
Stores click events.

### affiliate_conversions
Stores conversion attribution.

### affiliate_commissions
Stores commission ledger entries.

### audit_logs
Stores security and operational audit events.

### secret_refs
Stores metadata pointing to encrypted secrets.

## Data ownership rule

The app database is the source of truth for configuration.

n8n may read and act on configuration, but configuration ownership stays in the app.
