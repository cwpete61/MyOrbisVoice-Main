# Docker topology

## Local development services

- reverse-proxy
- app-web
- app-api
- voice-gateway
- n8n-main
- n8n-worker
- postgres
- redis
- optional mail testing service
- optional monitoring service

## Production services on Contabo

- reverse-proxy
- app-web
- app-api
- voice-gateway
- n8n-main
- n8n-worker
- postgres
- redis
- backup service
- monitoring / alerting service

## Network boundaries

### Edge network
Exposed services:
- reverse-proxy only

### App network
Internal services:
- app-web
- app-api
- voice-gateway
- postgres
- redis

### Automation network
Internal services:
- n8n-main
- n8n-worker
- postgres
- redis

## Rules

1. Only the reverse proxy exposes public ports.
2. Databases and Redis stay internal.
3. n8n stays internal behind protected access.
4. Volumes must be persistent for PostgreSQL and n8n data.
5. Production must include restart policies and health checks.
