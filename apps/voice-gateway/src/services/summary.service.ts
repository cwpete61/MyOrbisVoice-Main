import OpenAI from 'openai'
import { env } from '../lib/env.js'
import type { TranscriptEntry } from './conversation.service.js'

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY })

export async function generateSummary(transcript: TranscriptEntry[]): Promise<string> {
  if (transcript.length === 0) return 'No conversation.'
  if (!env.OPENAI_API_KEY) return 'Summary unavailable (no OpenAI key configured).'

  const text = transcript
    .map(e => `${e.role === 'user' ? 'Caller' : 'Agent'}: ${e.text}`)
    .join('\n')

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You summarize call transcripts in 2-3 sentences. Focus on: what the caller needed, what was resolved or promised, and any next steps. Be factual and concise.',
      },
      { role: 'user', content: text },
    ],
    max_tokens: 200,
    temperature: 0.2,
  })

  return res.choices[0]?.message?.content?.trim() ?? 'Summary unavailable.'
}
