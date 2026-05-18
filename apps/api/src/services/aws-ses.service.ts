import {
  SESv2Client,
  CreateEmailIdentityCommand,
  GetEmailIdentityCommand,
} from '@aws-sdk/client-sesv2'
import { getConfigValue } from './system-config.service.js'

// Amazon SES service — the platform's cold-email sending provider for Bulk
// Email. Wraps SES v2: creating a per-partner domain identity with Easy DKIM
// and polling its verification status. getAwsConfig is the shared reader for
// the platform AWS credentials (also used by the Route 53 Domains service).

export interface AwsConfig {
  accessKeyId: string
  secretAccessKey: string
  region: string
}

export async function getAwsConfig(): Promise<AwsConfig | null> {
  const [keyId, secret, region] = await Promise.all([
    getConfigValue('aws_ses_access_key_id'),
    getConfigValue('aws_ses_secret_access_key'),
    getConfigValue('aws_ses_region'),
  ])
  const accessKeyId = keyId || process.env['AWS_SES_ACCESS_KEY_ID'] || ''
  const secretAccessKey = secret || process.env['AWS_SES_SECRET_ACCESS_KEY'] || ''
  const reg = region || process.env['AWS_SES_REGION'] || 'us-east-1'
  if (!accessKeyId || !secretAccessKey) return null
  return { accessKeyId, secretAccessKey, region: reg }
}

async function sesClient(): Promise<SESv2Client> {
  const cfg = await getAwsConfig()
  if (!cfg) throw new Error('Amazon SES is not configured (Admin → System Settings)')
  return new SESv2Client({
    region: cfg.region,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  })
}

export interface DomainIdentity {
  domain: string
  dkimTokens: string[] // 3 Easy-DKIM tokens — written into DNS as CNAMEs
  verified: boolean
  dkimStatus: string // 'SUCCESS' | 'PENDING' | 'FAILED' | 'TEMPORARY_FAILURE' | 'NOT_STARTED'
}

function toIdentity(domain: string, res: { DkimAttributes?: { Tokens?: string[]; Status?: string }; VerifiedForSendingStatus?: boolean }): DomainIdentity {
  return {
    domain,
    dkimTokens: res.DkimAttributes?.Tokens ?? [],
    verified: res.VerifiedForSendingStatus ?? false,
    dkimStatus: res.DkimAttributes?.Status ?? 'NOT_STARTED',
  }
}

/** Create an SES domain identity with Easy DKIM. Idempotent — if the identity
 *  already exists, fetches and returns it instead. The 3 DKIM tokens get
 *  written into the domain's DNS as CNAMEs; once they resolve, SES verifies
 *  the domain for sending (no separate verification TXT needed). */
export async function createDomainIdentity(domain: string): Promise<DomainIdentity> {
  const client = await sesClient()
  try {
    const res = await client.send(new CreateEmailIdentityCommand({ EmailIdentity: domain }))
    return toIdentity(domain, res)
  } catch (err) {
    if ((err as { name?: string })?.name === 'AlreadyExistsException') {
      return getDomainIdentity(domain)
    }
    throw err
  }
}

/** Fetch an SES domain identity — used to poll DKIM + verification status. */
export async function getDomainIdentity(domain: string): Promise<DomainIdentity> {
  const client = await sesClient()
  const res = await client.send(new GetEmailIdentityCommand({ EmailIdentity: domain }))
  return toIdentity(domain, res)
}
