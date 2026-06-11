'use client'

import { useLocale } from '@/lib/i18n/I18nProvider'

/** Grade bands for the Lead Capture Evaluation (shared by the eval + the CRM). */
export interface LeadGrade { min: number; letter: string; en: string; es: string; color: string }
export const LEAD_GRADES: LeadGrade[] = [
  { min: 90, letter: 'A', en: 'Locked Tight', es: 'Bien cerrado', color: 'oklch(72% 0.17 145)' },
  { min: 75, letter: 'B', en: 'Solid — Minor Leaks', es: 'Sólido — fugas menores', color: 'oklch(78% 0.15 165)' },
  { min: 60, letter: 'C', en: 'Leaking Leads', es: 'Perdiendo clientes', color: 'oklch(80% 0.14 90)' },
  { min: 40, letter: 'D', en: 'Major Leaks', es: 'Fugas importantes', color: 'oklch(72% 0.16 55)' },
  { min: 0,  letter: 'F', en: 'Critical', es: 'Crítico', color: 'oklch(63% 0.20 25)' },
]
export function gradeFor(score: number): LeadGrade {
  return LEAD_GRADES.find((g) => score >= g.min) ?? LEAD_GRADES[LEAD_GRADES.length - 1]!
}

/** The 6 scored categories (labels + max). */
export const LEAD_CATS: { key: string; max: number; en: string; es: string }[] = [
  { key: 'speed',      max: 20, en: 'Speed to Answer',            es: 'Velocidad de respuesta' },
  { key: 'greeting',   max: 15, en: 'Greeting & Professionalism', es: 'Saludo y profesionalismo' },
  { key: 'capture',    max: 20, en: 'Lead Capture',               es: 'Captura del lead' },
  { key: 'conversion', max: 20, en: 'Conversion Action',          es: 'Acción de conversión' },
  { key: 'afterhours', max: 15, en: 'After-Hours Coverage',       es: 'Cobertura fuera de horario' },
  { key: 'followup',   max: 10, en: 'Follow-Up / Callback',       es: 'Seguimiento / devolución' },
]

/** Compact pill: "72 · B", colored by grade. */
export function LeadScoreBadge({ score, grade }: { score: number; grade?: string | null }) {
  const { locale } = useLocale()
  const L = locale === 'es' ? 'es' : 'en'
  const g = gradeFor(score)
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold leading-none"
      style={{ background: `color-mix(in oklab, ${g.color} 18%, transparent)`, color: g.color }}
      title={`${L === 'es' ? g.es : g.en} (${score}/100)`}
    >
      {score} · {grade || g.letter}
    </span>
  )
}
