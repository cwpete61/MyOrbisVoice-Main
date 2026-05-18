import {
  Route53DomainsClient,
  CheckDomainAvailabilityCommand,
  RegisterDomainCommand,
  GetOperationDetailCommand,
  UpdateDomainNameserversCommand,
  ListPricesCommand,
  type ContactDetail,
  type CountryCode,
} from '@aws-sdk/client-route-53-domains'
import { getAwsConfig } from './aws-ses.service.js'

// Route 53 Domains service — registers each partner's dedicated .com for Bulk
// Email and points it at Cloudflare's name servers. Uses the same platform
// AWS credentials as SES. The Route 53 Domains API lives only in us-east-1
// regardless of where SES runs.

async function r53Client(): Promise<Route53DomainsClient> {
  const cfg = await getAwsConfig()
  if (!cfg) throw new Error('AWS is not configured (Admin → System Settings)')
  return new Route53DomainsClient({
    region: 'us-east-1',
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  })
}

/** Whether a domain is available to register right now. */
export async function isDomainAvailable(domain: string): Promise<boolean> {
  const client = await r53Client()
  const res = await client.send(new CheckDomainAvailabilityCommand({ DomainName: domain }))
  return res.Availability === 'AVAILABLE'
}

/** Registration price for a TLD, in USD — drives what the partner is charged. */
export async function getRegistrationPriceUsd(tld = 'com'): Promise<number | null> {
  const client = await r53Client()
  const res = await client.send(new ListPricesCommand({ Tld: tld }))
  return res.Prices?.[0]?.RegistrationPrice?.Price ?? null
}

export interface RegistrantContact {
  firstName: string
  lastName: string
  email: string
  phoneNumber: string // Route 53 format: "+1.5551234567"
  addressLine1: string
  city: string
  state: string
  countryCode: string // ISO 3166 alpha-2, e.g. "US"
  zipCode: string
  organizationName?: string
}

function toContactDetail(c: RegistrantContact): ContactDetail {
  const contactType = c.organizationName ? 'COMPANY' : 'PERSON'
  return {
    FirstName: c.firstName,
    LastName: c.lastName,
    ContactType: contactType,
    OrganizationName: c.organizationName,
    AddressLine1: c.addressLine1,
    City: c.city,
    State: c.state,
    CountryCode: c.countryCode as CountryCode,
    ZipCode: c.zipCode,
    PhoneNumber: c.phoneNumber,
    Email: c.email,
  }
}

/** Register a domain. Async on AWS's side — returns an operation id to poll
 *  via getOperationStatus. WHOIS privacy protection is enabled on all three
 *  contacts so the registrant details never appear in public WHOIS. */
export async function registerDomain(domain: string, contact: RegistrantContact): Promise<string> {
  const client = await r53Client()
  const detail = toContactDetail(contact)
  const res = await client.send(new RegisterDomainCommand({
    DomainName: domain,
    DurationInYears: 1,
    AutoRenew: true,
    AdminContact: detail,
    RegistrantContact: detail,
    TechContact: detail,
    PrivacyProtectAdminContact: true,
    PrivacyProtectRegistrantContact: true,
    PrivacyProtectTechContact: true,
  }))
  if (!res.OperationId) throw new Error('Route 53 RegisterDomain returned no operation id')
  return res.OperationId
}

export interface OperationResult {
  status: string // 'SUBMITTED' | 'IN_PROGRESS' | 'SUCCESSFUL' | 'ERROR' | 'FAILED' | 'STALLED'
  message?: string
}

/** Poll a Route 53 Domains async operation (register / nameserver update). */
export async function getOperationStatus(operationId: string): Promise<OperationResult> {
  const client = await r53Client()
  const res = await client.send(new GetOperationDetailCommand({ OperationId: operationId }))
  return { status: res.Status ?? 'SUBMITTED', message: res.Message }
}

/** Point a registered domain's name servers at Cloudflare. Returns an
 *  operation id to poll. */
export async function setDomainNameservers(domain: string, nameservers: string[]): Promise<string> {
  const client = await r53Client()
  const res = await client.send(new UpdateDomainNameserversCommand({
    DomainName: domain,
    Nameservers: nameservers.map(ns => ({ Name: ns })),
  }))
  if (!res.OperationId) throw new Error('Route 53 UpdateDomainNameservers returned no operation id')
  return res.OperationId
}
