# Build rules

1. The SaaS app owns configuration.
2. n8n owns orchestration, not the customer UI.
3. The voice gateway owns live audio sessions.
4. All prompts are versioned.
5. All secrets are encrypted and write-only.
6. Google accounts connect through OAuth.
7. Transactional email stays separate from human mailbox email.
8. Feature access is determined by entitlements and quotas.
9. Admin impersonation is logged.
10. Every major phase ends with a manual test gate.
