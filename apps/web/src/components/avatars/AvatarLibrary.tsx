'use client'

export interface AvatarDef {
  id: string
  gender: 'male' | 'female'
  label: string
  component: React.FC<{ size?: number; selected?: boolean }>
}

// ─── Female Avatars ───────────────────────────────────────────────────────────

function FemaleAvatar1({ size = 72, selected = false }: { size?: number; selected?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ borderRadius: '50%', outline: selected ? '3px solid oklch(70% 0.16 193)' : 'none', outlineOffset: 2 }}>
      <circle cx="36" cy="36" r="36" fill="oklch(30% 0.08 200)"/>
      {/* Shoulders */}
      <ellipse cx="36" cy="68" rx="20" ry="12" fill="oklch(55% 0.18 200)"/>
      {/* Neck */}
      <rect x="31" y="50" width="10" height="10" rx="3" fill="oklch(82% 0.06 30)"/>
      {/* Face */}
      <ellipse cx="36" cy="36" rx="14" ry="16" fill="oklch(82% 0.06 30)"/>
      {/* Hair — long, side-parted */}
      <path d="M22 28 Q22 14 36 12 Q50 14 50 28 Q48 22 36 20 Q24 22 22 28Z" fill="oklch(25% 0.05 30)"/>
      <path d="M22 28 Q20 40 21 52 Q24 50 24 44 Q24 36 26 30Z" fill="oklch(25% 0.05 30)"/>
      <path d="M50 28 Q52 40 51 52 Q48 50 48 44 Q48 36 46 30Z" fill="oklch(25% 0.05 30)"/>
      {/* Eyes */}
      <ellipse cx="29" cy="35" rx="3" ry="3.5" fill="white"/>
      <circle cx="29" cy="35.5" r="2" fill="oklch(25% 0.05 230)"/>
      <circle cx="29.8" cy="34.8" r="0.7" fill="white"/>
      <ellipse cx="43" cy="35" rx="3" ry="3.5" fill="white"/>
      <circle cx="43" cy="35.5" r="2" fill="oklch(25% 0.05 230)"/>
      <circle cx="43.8" cy="34.8" r="0.7" fill="white"/>
      {/* Eyebrows */}
      <path d="M26 31 Q29 29.5 32 31" stroke="oklch(25% 0.05 30)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      <path d="M40 31 Q43 29.5 46 31" stroke="oklch(25% 0.05 30)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      {/* Nose */}
      <path d="M35 37 Q34 41 33 42 Q36 43 39 42 Q38 41 37 37" stroke="oklch(70% 0.06 30)" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
      {/* Mouth */}
      <path d="M31 46 Q36 50 41 46" stroke="oklch(60% 0.12 15)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <path d="M32 47 Q36 49 40 47" stroke="oklch(75% 0.12 15)" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
      {/* Earrings */}
      <circle cx="22" cy="40" r="1.5" fill="oklch(80% 0.15 60)"/>
      <circle cx="50" cy="40" r="1.5" fill="oklch(80% 0.15 60)"/>
    </svg>
  )
}

function FemaleAvatar2({ size = 72, selected = false }: { size?: number; selected?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ borderRadius: '50%', outline: selected ? '3px solid oklch(70% 0.16 193)' : 'none', outlineOffset: 2 }}>
      <circle cx="36" cy="36" r="36" fill="oklch(22% 0.04 270)"/>
      <ellipse cx="36" cy="68" rx="20" ry="12" fill="oklch(45% 0.12 15)"/>
      <rect x="31" y="50" width="10" height="10" rx="3" fill="oklch(65% 0.08 25)"/>
      <ellipse cx="36" cy="36" rx="14" ry="16" fill="oklch(65% 0.08 25)"/>
      {/* Hair — curly/voluminous */}
      <path d="M22 26 Q20 12 36 10 Q52 12 50 26" fill="oklch(15% 0.03 30)"/>
      <ellipse cx="22" cy="26" rx="5" ry="7" fill="oklch(15% 0.03 30)"/>
      <ellipse cx="50" cy="26" rx="5" ry="7" fill="oklch(15% 0.03 30)"/>
      <ellipse cx="28" cy="18" rx="5" ry="6" fill="oklch(15% 0.03 30)"/>
      <ellipse cx="44" cy="18" rx="5" ry="6" fill="oklch(15% 0.03 30)"/>
      <ellipse cx="36" cy="14" rx="5" ry="5" fill="oklch(15% 0.03 30)"/>
      <ellipse cx="22" cy="38" rx="4" ry="8" fill="oklch(15% 0.03 30)"/>
      <ellipse cx="50" cy="38" rx="4" ry="8" fill="oklch(15% 0.03 30)"/>
      <ellipse cx="29" cy="35" rx="3" ry="3.5" fill="white"/>
      <circle cx="29" cy="35.5" r="2" fill="oklch(20% 0.06 230)"/>
      <circle cx="29.8" cy="34.8" r="0.7" fill="white"/>
      <ellipse cx="43" cy="35" rx="3" ry="3.5" fill="white"/>
      <circle cx="43" cy="35.5" r="2" fill="oklch(20% 0.06 230)"/>
      <circle cx="43.8" cy="34.8" r="0.7" fill="white"/>
      <path d="M26.5 31 Q29 30 31.5 31" stroke="oklch(15% 0.03 30)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      <path d="M40.5 31 Q43 30 45.5 31" stroke="oklch(15% 0.03 30)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      <path d="M35 37 Q34 41 33 42 Q36 43 39 42 Q38 41 37 37" stroke="oklch(55% 0.06 25)" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
      <path d="M31 46 Q36 50 41 46" stroke="oklch(55% 0.14 15)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    </svg>
  )
}

function FemaleAvatar3({ size = 72, selected = false }: { size?: number; selected?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ borderRadius: '50%', outline: selected ? '3px solid oklch(70% 0.16 193)' : 'none', outlineOffset: 2 }}>
      <circle cx="36" cy="36" r="36" fill="oklch(28% 0.06 175)"/>
      <ellipse cx="36" cy="68" rx="20" ry="12" fill="oklch(48% 0.15 175)"/>
      <rect x="31" y="50" width="10" height="10" rx="3" fill="oklch(90% 0.04 35)"/>
      <ellipse cx="36" cy="36" rx="14" ry="16" fill="oklch(90% 0.04 35)"/>
      {/* Hair — straight bob */}
      <path d="M22 26 Q22 12 36 11 Q50 12 50 26 Q48 20 36 18 Q24 20 22 26Z" fill="oklch(72% 0.18 40)"/>
      <rect x="21" y="26" width="5" height="22" rx="2" fill="oklch(72% 0.18 40)"/>
      <rect x="46" y="26" width="5" height="22" rx="2" fill="oklch(72% 0.18 40)"/>
      <rect x="22" y="44" width="28" height="4" rx="2" fill="oklch(72% 0.18 40)"/>
      <ellipse cx="29" cy="35" rx="3" ry="3.5" fill="white"/>
      <circle cx="29" cy="35.5" r="2" fill="oklch(25% 0.08 200)"/>
      <circle cx="29.8" cy="34.8" r="0.7" fill="white"/>
      <ellipse cx="43" cy="35" rx="3" ry="3.5" fill="white"/>
      <circle cx="43" cy="35.5" r="2" fill="oklch(25% 0.08 200)"/>
      <circle cx="43.8" cy="34.8" r="0.7" fill="white"/>
      <path d="M26 31.5 Q29 30 32 31.5" stroke="oklch(72% 0.18 40)" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
      <path d="M40 31.5 Q43 30 46 31.5" stroke="oklch(72% 0.18 40)" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
      <path d="M35 37 Q34 41 33 42 Q36 43 39 42 Q38 41 37 37" stroke="oklch(78% 0.04 35)" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
      <path d="M31 46 Q36 50 41 46" stroke="oklch(65% 0.16 15)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <path d="M32 47 Q36 49 40 47" stroke="oklch(78% 0.16 15)" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
      {/* Pearl earrings */}
      <circle cx="22.5" cy="39" r="2" fill="white" stroke="oklch(80% 0.05 60)" strokeWidth="0.5"/>
      <circle cx="49.5" cy="39" r="2" fill="white" stroke="oklch(80% 0.05 60)" strokeWidth="0.5"/>
    </svg>
  )
}

function FemaleAvatar4({ size = 72, selected = false }: { size?: number; selected?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ borderRadius: '50%', outline: selected ? '3px solid oklch(70% 0.16 193)' : 'none', outlineOffset: 2 }}>
      <circle cx="36" cy="36" r="36" fill="oklch(32% 0.06 280)"/>
      <ellipse cx="36" cy="68" rx="20" ry="12" fill="oklch(52% 0.10 280)"/>
      <rect x="31" y="50" width="10" height="10" rx="3" fill="oklch(75% 0.06 30)"/>
      <ellipse cx="36" cy="36" rx="14" ry="16" fill="oklch(75% 0.06 30)"/>
      {/* Hair — ponytail */}
      <path d="M22 26 Q22 12 36 11 Q50 12 50 26 Q46 18 36 17 Q26 18 22 26Z" fill="oklch(35% 0.08 30)"/>
      <ellipse cx="36" cy="14" rx="10" ry="6" fill="oklch(35% 0.08 30)"/>
      {/* Ponytail */}
      <path d="M44 18 Q54 16 56 22 Q54 26 48 24 Q52 20 44 18Z" fill="oklch(35% 0.08 30)"/>
      <ellipse cx="22" cy="30" rx="3" ry="6" fill="oklch(75% 0.06 30)"/>
      <ellipse cx="50" cy="30" rx="3" ry="6" fill="oklch(75% 0.06 30)"/>
      <ellipse cx="29" cy="35" rx="3" ry="3.5" fill="white"/>
      <circle cx="29" cy="35.5" r="2" fill="oklch(28% 0.08 200)"/>
      <circle cx="29.8" cy="34.8" r="0.7" fill="white"/>
      <ellipse cx="43" cy="35" rx="3" ry="3.5" fill="white"/>
      <circle cx="43" cy="35.5" r="2" fill="oklch(28% 0.08 200)"/>
      <circle cx="43.8" cy="34.8" r="0.7" fill="white"/>
      <path d="M26.5 31 Q29 29.5 31.5 31" stroke="oklch(35% 0.08 30)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      <path d="M40.5 31 Q43 29.5 45.5 31" stroke="oklch(35% 0.08 30)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      <path d="M34 38 Q34.5 41 33 42 Q36 43.5 39 42 Q37.5 41 38 38" stroke="oklch(65% 0.06 30)" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
      <path d="M31 46 Q36 50 41 46" stroke="oklch(58% 0.18 15)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      {/* Small stud earrings */}
      <circle cx="22.5" cy="39" r="1.5" fill="oklch(75% 0.20 60)"/>
      <circle cx="49.5" cy="39" r="1.5" fill="oklch(75% 0.20 60)"/>
    </svg>
  )
}

function FemaleAvatar5({ size = 72, selected = false }: { size?: number; selected?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ borderRadius: '50%', outline: selected ? '3px solid oklch(70% 0.16 193)' : 'none', outlineOffset: 2 }}>
      <circle cx="36" cy="36" r="36" fill="oklch(24% 0.04 220)"/>
      <ellipse cx="36" cy="68" rx="20" ry="12" fill="oklch(44% 0.14 220)"/>
      <rect x="31" y="50" width="10" height="10" rx="3" fill="oklch(55% 0.07 20)"/>
      <ellipse cx="36" cy="36" rx="14" ry="16" fill="oklch(55% 0.07 20)"/>
      {/* Hair — braids/locs */}
      <path d="M22 26 Q22 12 36 11 Q50 12 50 26" fill="oklch(12% 0.02 30)"/>
      {/* Individual braids */}
      <rect x="20" y="22" width="4" height="30" rx="2" fill="oklch(12% 0.02 30)"/>
      <rect x="25" y="16" width="4" height="36" rx="2" fill="oklch(12% 0.02 30)"/>
      <rect x="30" y="13" width="4" height="14" rx="2" fill="oklch(12% 0.02 30)"/>
      <rect x="38" y="13" width="4" height="14" rx="2" fill="oklch(12% 0.02 30)"/>
      <rect x="43" y="16" width="4" height="36" rx="2" fill="oklch(12% 0.02 30)"/>
      <rect x="48" y="22" width="4" height="30" rx="2" fill="oklch(12% 0.02 30)"/>
      <ellipse cx="29" cy="35" rx="3" ry="3.5" fill="white"/>
      <circle cx="29" cy="35.5" r="2" fill="oklch(18% 0.04 230)"/>
      <circle cx="29.8" cy="34.8" r="0.7" fill="white"/>
      <ellipse cx="43" cy="35" rx="3" ry="3.5" fill="white"/>
      <circle cx="43" cy="35.5" r="2" fill="oklch(18% 0.04 230)"/>
      <circle cx="43.8" cy="34.8" r="0.7" fill="white"/>
      <path d="M26.5 31 Q29 30 31.5 31" stroke="oklch(12% 0.02 30)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      <path d="M40.5 31 Q43 30 45.5 31" stroke="oklch(12% 0.02 30)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      <path d="M34 38 Q34.5 41 33 42 Q36 43.5 39 42 Q37.5 41 38 38" stroke="oklch(45% 0.06 20)" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
      <path d="M31 46 Q36 50 41 46" stroke="oklch(45% 0.16 10)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <circle cx="22" cy="39" r="1.8" fill="oklch(65% 0.22 180)"/>
      <circle cx="50" cy="39" r="1.8" fill="oklch(65% 0.22 180)"/>
    </svg>
  )
}

function FemaleAvatar6({ size = 72, selected = false }: { size?: number; selected?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ borderRadius: '50%', outline: selected ? '3px solid oklch(70% 0.16 193)' : 'none', outlineOffset: 2 }}>
      <circle cx="36" cy="36" r="36" fill="oklch(30% 0.08 155)"/>
      <ellipse cx="36" cy="68" rx="20" ry="12" fill="oklch(50% 0.16 155)"/>
      <rect x="31" y="50" width="10" height="10" rx="3" fill="oklch(88% 0.04 30)"/>
      <ellipse cx="36" cy="36" rx="14" ry="16" fill="oklch(88% 0.04 30)"/>
      {/* Hair — updo/bun */}
      <path d="M22 28 Q22 14 36 12 Q50 14 50 28 Q48 22 36 20 Q24 22 22 28Z" fill="oklch(50% 0.16 30)"/>
      <ellipse cx="36" cy="14" rx="9" ry="7" fill="oklch(50% 0.16 30)"/>
      <ellipse cx="36" cy="11" rx="6" ry="5" fill="oklch(45% 0.16 30)"/>
      <ellipse cx="22.5" cy="34" rx="3" ry="10" fill="oklch(88% 0.04 30)"/>
      <ellipse cx="49.5" cy="34" rx="3" ry="10" fill="oklch(88% 0.04 30)"/>
      <ellipse cx="29" cy="35" rx="3" ry="3.5" fill="white"/>
      <circle cx="29" cy="35.5" r="2" fill="oklch(28% 0.10 200)"/>
      <circle cx="29.8" cy="34.8" r="0.7" fill="white"/>
      <ellipse cx="43" cy="35" rx="3" ry="3.5" fill="white"/>
      <circle cx="43" cy="35.5" r="2" fill="oklch(28% 0.10 200)"/>
      <circle cx="43.8" cy="34.8" r="0.7" fill="white"/>
      <path d="M26 31.5 Q29 30 32 31.5" stroke="oklch(50% 0.16 30)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      <path d="M40 31.5 Q43 30 46 31.5" stroke="oklch(50% 0.16 30)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      <path d="M34 38 Q34.5 41 33 42 Q36 43.5 39 42 Q37.5 41 38 38" stroke="oklch(76% 0.04 30)" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
      <path d="M31 46 Q36 50 41 46" stroke="oklch(62% 0.18 15)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <path d="M32 47 Q36 49 40 47" stroke="oklch(78% 0.18 15)" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
    </svg>
  )
}

// ─── Male Avatars ─────────────────────────────────────────────────────────────

function MaleAvatar1({ size = 72, selected = false }: { size?: number; selected?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ borderRadius: '50%', outline: selected ? '3px solid oklch(70% 0.16 193)' : 'none', outlineOffset: 2 }}>
      <circle cx="36" cy="36" r="36" fill="oklch(28% 0.08 210)"/>
      <ellipse cx="36" cy="68" rx="22" ry="12" fill="oklch(42% 0.14 210)"/>
      <rect x="31" y="50" width="10" height="10" rx="3" fill="oklch(82% 0.06 30)"/>
      <ellipse cx="36" cy="37" rx="14" ry="15" fill="oklch(82% 0.06 30)"/>
      {/* Hair — short, neat side part */}
      <path d="M22 28 Q22 13 36 12 Q50 13 50 28 Q46 20 36 19 Q26 20 22 28Z" fill="oklch(22% 0.04 30)"/>
      <path d="M22 28 Q23 26 26 25 Q22 28 22 30Z" fill="oklch(22% 0.04 30)"/>
      <ellipse cx="22.5" cy="37" rx="3" ry="7" fill="oklch(82% 0.06 30)"/>
      <ellipse cx="49.5" cy="37" rx="3" ry="7" fill="oklch(82% 0.06 30)"/>
      <ellipse cx="29" cy="36" rx="3" ry="3.5" fill="white"/>
      <circle cx="29" cy="36.5" r="2" fill="oklch(22% 0.04 200)"/>
      <circle cx="29.8" cy="35.8" r="0.7" fill="white"/>
      <ellipse cx="43" cy="36" rx="3" ry="3.5" fill="white"/>
      <circle cx="43" cy="36.5" r="2" fill="oklch(22% 0.04 200)"/>
      <circle cx="43.8" cy="35.8" r="0.7" fill="white"/>
      {/* Stronger brows */}
      <path d="M25.5 31 Q29 29 32.5 31" stroke="oklch(22% 0.04 30)" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M39.5 31 Q43 29 46.5 31" stroke="oklch(22% 0.04 30)" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M34.5 38 Q34 42 33 43 Q36 44.5 39 43 Q38 42 37.5 38" stroke="oklch(70% 0.06 30)" strokeWidth="0.9" fill="none" strokeLinecap="round"/>
      {/* Mouth — neutral/slight smile */}
      <path d="M32 47 Q36 50 40 47" stroke="oklch(55% 0.08 15)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      {/* Light stubble */}
      <path d="M29 48 Q36 51 43 48" stroke="oklch(70% 0.06 30)" strokeWidth="0.6" strokeDasharray="1 1.5" fill="none"/>
    </svg>
  )
}

function MaleAvatar2({ size = 72, selected = false }: { size?: number; selected?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ borderRadius: '50%', outline: selected ? '3px solid oklch(70% 0.16 193)' : 'none', outlineOffset: 2 }}>
      <circle cx="36" cy="36" r="36" fill="oklch(22% 0.04 260)"/>
      <ellipse cx="36" cy="68" rx="22" ry="12" fill="oklch(38% 0.10 15)"/>
      <rect x="31" y="50" width="10" height="10" rx="3" fill="oklch(60% 0.08 25)"/>
      <ellipse cx="36" cy="37" rx="14" ry="15" fill="oklch(60% 0.08 25)"/>
      {/* Hair — very short/close cut */}
      <path d="M22 28 Q22 14 36 12 Q50 14 50 28 Q49 24 36 22 Q23 24 22 28Z" fill="oklch(10% 0.02 30)"/>
      <ellipse cx="22.5" cy="37" rx="3" ry="7" fill="oklch(60% 0.08 25)"/>
      <ellipse cx="49.5" cy="37" rx="3" ry="7" fill="oklch(60% 0.08 25)"/>
      <ellipse cx="29" cy="36" rx="3" ry="3.5" fill="white"/>
      <circle cx="29" cy="36.5" r="2" fill="oklch(18% 0.04 200)"/>
      <circle cx="29.8" cy="35.8" r="0.7" fill="white"/>
      <ellipse cx="43" cy="36" rx="3" ry="3.5" fill="white"/>
      <circle cx="43" cy="36.5" r="2" fill="oklch(18% 0.04 200)"/>
      <circle cx="43.8" cy="35.8" r="0.7" fill="white"/>
      <path d="M25.5 31 Q29 29 32.5 31" stroke="oklch(10% 0.02 30)" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <path d="M39.5 31 Q43 29 46.5 31" stroke="oklch(10% 0.02 30)" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <path d="M34.5 38 Q34 42 33 43 Q36 44.5 39 43 Q38 42 37.5 38" stroke="oklch(50% 0.07 25)" strokeWidth="0.9" fill="none" strokeLinecap="round"/>
      <path d="M31 47 Q36 50 41 47" stroke="oklch(42% 0.08 15)" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
      {/* Beard */}
      <path d="M27 44 Q26 50 30 53 Q36 55 42 53 Q46 50 45 44 Q41 48 36 48 Q31 48 27 44Z" fill="oklch(10% 0.02 30)" opacity="0.7"/>
    </svg>
  )
}

function MaleAvatar3({ size = 72, selected = false }: { size?: number; selected?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ borderRadius: '50%', outline: selected ? '3px solid oklch(70% 0.16 193)' : 'none', outlineOffset: 2 }}>
      <circle cx="36" cy="36" r="36" fill="oklch(26% 0.06 185)"/>
      <ellipse cx="36" cy="68" rx="22" ry="12" fill="oklch(46% 0.16 185)"/>
      <rect x="31" y="50" width="10" height="10" rx="3" fill="oklch(92% 0.03 35)"/>
      <ellipse cx="36" cy="37" rx="14" ry="15" fill="oklch(92% 0.03 35)"/>
      {/* Hair — light/blonde, longer on top */}
      <path d="M22 28 Q22 12 36 10 Q50 12 50 28 Q47 18 36 16 Q25 18 22 28Z" fill="oklch(88% 0.12 75)"/>
      <path d="M22 28 Q21 36 22 40 Q24 38 24 32Z" fill="oklch(88% 0.12 75)"/>
      <path d="M50 28 Q51 36 50 40 Q48 38 48 32Z" fill="oklch(88% 0.12 75)"/>
      <ellipse cx="22.5" cy="37" rx="3" ry="7" fill="oklch(92% 0.03 35)"/>
      <ellipse cx="49.5" cy="37" rx="3" ry="7" fill="oklch(92% 0.03 35)"/>
      <ellipse cx="29" cy="36" rx="3" ry="3.5" fill="white"/>
      <circle cx="29" cy="36.5" r="2" fill="oklch(35% 0.12 200)"/>
      <circle cx="29.8" cy="35.8" r="0.7" fill="white"/>
      <ellipse cx="43" cy="36" rx="3" ry="3.5" fill="white"/>
      <circle cx="43" cy="36.5" r="2" fill="oklch(35% 0.12 200)"/>
      <circle cx="43.8" cy="35.8" r="0.7" fill="white"/>
      <path d="M25.5 31 Q29 29.5 32.5 31" stroke="oklch(75% 0.12 75)" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
      <path d="M39.5 31 Q43 29.5 46.5 31" stroke="oklch(75% 0.12 75)" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
      <path d="M34.5 38 Q34 42 33 43 Q36 44.5 39 43 Q38 42 37.5 38" stroke="oklch(80% 0.03 35)" strokeWidth="0.9" fill="none" strokeLinecap="round"/>
      <path d="M31 47 Q36 51 41 47" stroke="oklch(68% 0.10 15)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    </svg>
  )
}

function MaleAvatar4({ size = 72, selected = false }: { size?: number; selected?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ borderRadius: '50%', outline: selected ? '3px solid oklch(70% 0.16 193)' : 'none', outlineOffset: 2 }}>
      <circle cx="36" cy="36" r="36" fill="oklch(20% 0.04 240)"/>
      <ellipse cx="36" cy="68" rx="22" ry="12" fill="oklch(40% 0.12 240)"/>
      <rect x="31" y="50" width="10" height="10" rx="3" fill="oklch(72% 0.06 28)"/>
      <ellipse cx="36" cy="37" rx="14" ry="15" fill="oklch(72% 0.06 28)"/>
      {/* Hair — medium brown, wavy */}
      <path d="M22 28 Q21 12 36 10 Q51 12 50 28" fill="oklch(30% 0.10 30)"/>
      <path d="M22 28 Q20 36 21 44 Q24 40 23 34 Q23 30 22 28Z" fill="oklch(30% 0.10 30)"/>
      <path d="M50 28 Q52 36 51 44 Q48 40 49 34 Q49 30 50 28Z" fill="oklch(30% 0.10 30)"/>
      {/* Wave texture on top */}
      <path d="M24 18 Q28 15 32 18 Q36 15 40 18 Q44 15 48 18" stroke="oklch(25% 0.08 30)" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <ellipse cx="22.5" cy="37" rx="3" ry="7" fill="oklch(72% 0.06 28)"/>
      <ellipse cx="49.5" cy="37" rx="3" ry="7" fill="oklch(72% 0.06 28)"/>
      <ellipse cx="29" cy="36" rx="3" ry="3.5" fill="white"/>
      <circle cx="29" cy="36.5" r="2.1" fill="oklch(30% 0.12 195)"/>
      <circle cx="29.8" cy="35.8" r="0.7" fill="white"/>
      <ellipse cx="43" cy="36" rx="3" ry="3.5" fill="white"/>
      <circle cx="43" cy="36.5" r="2.1" fill="oklch(30% 0.12 195)"/>
      <circle cx="43.8" cy="35.8" r="0.7" fill="white"/>
      <path d="M25.5 31 Q29 29 32.5 31" stroke="oklch(30% 0.10 30)" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M39.5 31 Q43 29 46.5 31" stroke="oklch(30% 0.10 30)" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M34.5 38 Q34 42 33 43 Q36 44.5 39 43 Q38 42 37.5 38" stroke="oklch(60% 0.06 28)" strokeWidth="0.9" fill="none" strokeLinecap="round"/>
      <path d="M31 47 Q36 51 41 47" stroke="oklch(52% 0.10 15)" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
      {/* Short beard */}
      <path d="M28 45 Q28 49 32 51 Q36 52 40 51 Q44 49 44 45" stroke="oklch(30% 0.10 30)" strokeWidth="1.2" fill="none" opacity="0.6"/>
    </svg>
  )
}

function MaleAvatar5({ size = 72, selected = false }: { size?: number; selected?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ borderRadius: '50%', outline: selected ? '3px solid oklch(70% 0.16 193)' : 'none', outlineOffset: 2 }}>
      <circle cx="36" cy="36" r="36" fill="oklch(26% 0.05 300)"/>
      <ellipse cx="36" cy="68" rx="22" ry="12" fill="oklch(46% 0.14 300)"/>
      <rect x="31" y="50" width="10" height="10" rx="3" fill="oklch(50% 0.07 22)"/>
      <ellipse cx="36" cy="37" rx="14" ry="15" fill="oklch(50% 0.07 22)"/>
      {/* Bald / very close shave */}
      <path d="M22 30 Q22 14 36 13 Q50 14 50 30" fill="oklch(45% 0.07 22)" opacity="0.4"/>
      <ellipse cx="22.5" cy="37" rx="3" ry="7" fill="oklch(50% 0.07 22)"/>
      <ellipse cx="49.5" cy="37" rx="3" ry="7" fill="oklch(50% 0.07 22)"/>
      <ellipse cx="29" cy="36" rx="3" ry="3.5" fill="white"/>
      <circle cx="29" cy="36.5" r="2" fill="oklch(20% 0.06 200)"/>
      <circle cx="29.8" cy="35.8" r="0.7" fill="white"/>
      <ellipse cx="43" cy="36" rx="3" ry="3.5" fill="white"/>
      <circle cx="43" cy="36.5" r="2" fill="oklch(20% 0.06 200)"/>
      <circle cx="43.8" cy="35.8" r="0.7" fill="white"/>
      <path d="M25.5 31 Q29 29 32.5 31" stroke="oklch(35% 0.06 22)" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
      <path d="M39.5 31 Q43 29 46.5 31" stroke="oklch(35% 0.06 22)" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
      <path d="M34.5 38 Q34 42 33 43 Q36 44.5 39 43 Q38 42 37.5 38" stroke="oklch(40% 0.06 22)" strokeWidth="0.9" fill="none" strokeLinecap="round"/>
      <path d="M31 47 Q36 51 41 47" stroke="oklch(35% 0.08 15)" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
      {/* Full beard */}
      <path d="M25 43 Q24 52 30 55 Q36 57 42 55 Q48 52 47 43 Q43 48 36 49 Q29 48 25 43Z" fill="oklch(35% 0.06 22)" opacity="0.75"/>
    </svg>
  )
}

function MaleAvatar6({ size = 72, selected = false }: { size?: number; selected?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ borderRadius: '50%', outline: selected ? '3px solid oklch(70% 0.16 193)' : 'none', outlineOffset: 2 }}>
      <circle cx="36" cy="36" r="36" fill="oklch(24% 0.06 165)"/>
      <ellipse cx="36" cy="68" rx="22" ry="12" fill="oklch(44% 0.16 165)"/>
      <rect x="31" y="50" width="10" height="10" rx="3" fill="oklch(86% 0.04 32)"/>
      <ellipse cx="36" cy="37" rx="14" ry="15" fill="oklch(86% 0.04 32)"/>
      {/* Hair — salt & pepper, distinguished */}
      <path d="M22 28 Q22 12 36 11 Q50 12 50 28 Q47 19 36 17 Q25 19 22 28Z" fill="oklch(55% 0.04 220)"/>
      <path d="M22 28 Q21 36 22 42 Q24 40 24 34Z" fill="oklch(55% 0.04 220)"/>
      <path d="M50 28 Q51 36 50 42 Q48 40 48 34Z" fill="oklch(55% 0.04 220)"/>
      {/* Grey streaks */}
      <path d="M32 17 Q33 20 33 24" stroke="white" strokeWidth="1.5" opacity="0.5" fill="none"/>
      <path d="M38 17 Q39 20 39 24" stroke="white" strokeWidth="1.5" opacity="0.5" fill="none"/>
      <ellipse cx="22.5" cy="37" rx="3" ry="7" fill="oklch(86% 0.04 32)"/>
      <ellipse cx="49.5" cy="37" rx="3" ry="7" fill="oklch(86% 0.04 32)"/>
      <ellipse cx="29" cy="36" rx="3" ry="3.5" fill="white"/>
      <circle cx="29" cy="36.5" r="2" fill="oklch(30% 0.10 200)"/>
      <circle cx="29.8" cy="35.8" r="0.7" fill="white"/>
      <ellipse cx="43" cy="36" rx="3" ry="3.5" fill="white"/>
      <circle cx="43" cy="36.5" r="2" fill="oklch(30% 0.10 200)"/>
      <circle cx="43.8" cy="35.8" r="0.7" fill="white"/>
      <path d="M25.5 31 Q29 29 32.5 31" stroke="oklch(45% 0.04 220)" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M39.5 31 Q43 29 46.5 31" stroke="oklch(45% 0.04 220)" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M34.5 38 Q34 42 33 43 Q36 44.5 39 43 Q38 42 37.5 38" stroke="oklch(75% 0.04 32)" strokeWidth="0.9" fill="none" strokeLinecap="round"/>
      <path d="M31 47 Q36 51 41 47" stroke="oklch(58% 0.08 15)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      {/* Subtle smile lines */}
      <path d="M27 42 Q26 46 27 48" stroke="oklch(75% 0.04 32)" strokeWidth="0.8" fill="none" opacity="0.5"/>
      <path d="M45 42 Q46 46 45 48" stroke="oklch(75% 0.04 32)" strokeWidth="0.8" fill="none" opacity="0.5"/>
    </svg>
  )
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const FEMALE_AVATARS: AvatarDef[] = [
  { id: 'f1', gender: 'female', label: 'Aria',    component: FemaleAvatar1 },
  { id: 'f2', gender: 'female', label: 'Zara',    component: FemaleAvatar2 },
  { id: 'f3', gender: 'female', label: 'Nadia',   component: FemaleAvatar3 },
  { id: 'f4', gender: 'female', label: 'Priya',   component: FemaleAvatar4 },
  { id: 'f5', gender: 'female', label: 'Amara',   component: FemaleAvatar5 },
  { id: 'f6', gender: 'female', label: 'Claire',  component: FemaleAvatar6 },
]

export const MALE_AVATARS: AvatarDef[] = [
  { id: 'm1', gender: 'male', label: 'Ethan',   component: MaleAvatar1 },
  { id: 'm2', gender: 'male', label: 'Marcus',  component: MaleAvatar2 },
  { id: 'm3', gender: 'male', label: 'Liam',    component: MaleAvatar3 },
  { id: 'm4', gender: 'male', label: 'Jordan',  component: MaleAvatar4 },
  { id: 'm5', gender: 'male', label: 'Darius',  component: MaleAvatar5 },
  { id: 'm6', gender: 'male', label: 'Victor',  component: MaleAvatar6 },
]

export const ALL_AVATARS = [...FEMALE_AVATARS, ...MALE_AVATARS]

export function getAvatar(id: string): AvatarDef | undefined {
  return ALL_AVATARS.find(a => a.id === id)
}

export function AvatarDisplay({ avatarId, size = 40 }: { avatarId: string | null | undefined; size?: number }) {
  const def = avatarId ? getAvatar(avatarId) : null
  if (!def) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: 'oklch(28% 0.10 193)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 16 16" fill="none" stroke="oklch(75% 0.10 193)" strokeWidth="1.5" strokeLinecap="round">
          <path d="M8 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-5 6a5 5 0 0 1 10 0" />
        </svg>
      </div>
    )
  }
  const Comp = def.component
  return <Comp size={size} />
}
