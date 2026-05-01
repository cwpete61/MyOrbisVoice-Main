import OpenAI from 'openai'
import { env } from '../lib/env.js'
import { getConfigValue } from '../lib/config.js'
import type { TranscriptEntry } from './conversation.service.js'

async function getOpenAiKey(): Promise<string> {
  const dbKey = await getConfigValue('openai_api_key')
  return dbKey || env.OPENAI_API_KEY
}

async function getOpenAiModel(): Promise<string> {
  const dbModel = await getConfigValue('openai_model')
  return dbModel || 'gpt-4o-mini'
}

export async function cleanTranscript(transcript: TranscriptEntry[]): Promise<TranscriptEntry[]> {
  if (transcript.length === 0) return transcript
  const apiKey = await getOpenAiKey()
  if (!apiKey) return transcript
  const openai = new OpenAI({ apiKey })
  const model = await getOpenAiModel()

  const raw = transcript.map(e => ({ role: e.role, text: e.text }))

  try {
    const res = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a transcript formatter. You receive a JSON array of transcript entries. Each entry has "role" and "text". Fix ONLY spacing and formatting artifacts caused by streaming ASR (e.g. "Ye s" → "Yes", "do ing" → "doing", "Than k you" → "Thank you", "that\' s" → "that\'s"). Do NOT change any words, add punctuation that was not there, or alter meaning. Return the corrected entries as a JSON array with the same structure. Output raw JSON only, no markdown.',
        },
        { role: 'user', content: JSON.stringify(raw) },
      ],
      max_tokens: 1000,
      temperature: 0,
    })

    const content = res.choices[0]?.message?.content?.trim() ?? ''
    const parsed = JSON.parse(content) as { role: string; text: string }[]
    return transcript.map((entry, i) => ({
      ...entry,
      text: parsed[i]?.text ?? entry.text,
    }))
  } catch {
    return transcript
  }
}

export async function generateSummary(transcript: TranscriptEntry[]): Promise<string> {
  if (transcript.length === 0) return 'No conversation.'
  const apiKey = await getOpenAiKey()
  if (!apiKey) return 'Summary unavailable (no OpenAI key configured).'
  const openai = new OpenAI({ apiKey })

  const text = transcript
    .map(e => `${e.role === 'user' ? 'Caller' : 'Agent'}: ${e.text}`)
    .join('\n')

  const model = await getOpenAiModel()
  const res = await openai.chat.completions.create({
    model,
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
