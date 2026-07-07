# MyOrbisAgents — Video Script Suite (Remotion)

Production-ready scripts for the MyOrbisAgents explainer + marketing video suite,
structured for **Remotion** (React-based programmatic video). Each piece is a
Remotion `<Composition>`: fps 30, with per-scene frame ranges, on-screen text,
motion notes, and voiceover (VO). Built on the locked marketing spine
(`docs/myorbisagents-brand-voice.md`) and the four persuasion beats: **reality
gap → Latino growth wave → Orby catches (sold as outcomes) → what success looks
like.**

Every piece ends on the same line: **"Don't take my word — try Orby yourself."**

---

## Shared elements (define once, reuse across all compositions)

**Brand:** MyOrbisAgents · agent Orby (the AI receptionist) · sample agent
"John Brown, Austin Realtors."
**Tagline:** **Orby catches. You close.**
**CTA (every piece):** *"Don't take my word — try Orby yourself. Call **(929) 640-3810** or talk to Orby at **myorbisagents.com**."* — (929) is the instant, no-PIN demo line.
**Voice/tone:** confident, warm, plain-spoken builder-to-builder. Never hype.
Sell the **outcome**, never the feature. Augmentation, never replacement — Orby
makes the agent look responsive; the agent still closes.
**Palette:** teal `#1a9898` primary, ink `#111`, warm off-white bg, alert amber
for the "lost" beats. Big type, generous whitespace.
**Music:** understated, building; drops out under phone-call sims so the call
carries.

### Reusable Remotion components (build once in `src/components/`)
- `<PhoneCallSim variant="rent-en" | "rent-es" | "sale-en" />` — animated call:
  caller/Orby chat bubbles timed to a VO track + a live **app panel** on the
  right that fills in as the call progresses (Lead → Qualified → Showing booked
  → Showing Brief). This is the hero asset — it shows phone **and** app at once.
- `<AppCockpit highlight="leads" | "showing" | "brief" />` — the agent app
  (PWA) mock: leads list, calendar, Showing Brief card. "Nothing typed — it
  fills itself."
- `<KpiCounter from={40} to={100} suffix="%" label="leads caught" />` — animated
  scoreboard numbers.
- `<RealityGap />` — split "current reality" (missed call, amber) vs "with Orby"
  (caught, teal).
- `<SpanishBadge />` — "También hablo español" chip that pops during bilingual moments.
- `<CTACard />` — the closing card (tagline + number + site). Identical everywhere.

### The canonical phone-call sim (reused, trimmed per piece)

Polished from a real 929 call. Two language variants; the app panel animates in
lockstep.

**`rent-en`:**
- **Orby:** "Hi, this is Orby with John Brown at Austin Realtors — *y también hablo español, si prefieres.* How can I help?"  → `<SpanishBadge />` pops
- **Caller:** "I saw the 3-bedroom near campus, for rent."
- **Orby:** "Great — $3,100 a month, fenced yard, washer-dryer, walk to campus. Want to come see it? When are you hoping to move in?"  → app: **Lead created**
- **Caller:** "Start of next month."
- **Orby:** "Perfect. Do you have pets, and roughly how many people are moving in?" → app: **Qualifying…**
- **Caller:** "Just me and a dog."
- **Orby:** "Got it. Earliest I have is today at 9, or tomorrow at 10 — which works?"  → app: **Offering earliest slot**
- **Caller:** "Tomorrow at 10."
- **Orby:** "Booked. I'll text your confirmation and hand John a brief so he's ready. Anything else?"  → app: **Showing booked · Confirmation sent · Showing Brief ✓**

**`rent-es`** (the wedge, in Spanish): same beats — Caller opens *"Hola, vi la
casa en renta cerca del campus,"* Orby responds fully in Spanish, books the
showing. On-screen English subtitles. This variant is the proof for the Latino beat.

> **Bilingual note (mandatory rule):** scripts below are the English masters.
> Each ships with a Spanish counterpart before release (VO + on-screen text
> translated; the `-es` phone variant already drafted above). ES generation is
> the paired follow-up — flagged at the end.

---

## 1. FULL EXPLAINER

`<Composition id="Explainer" width={1920} height={1080} fps={30} durationInFrames={3000} />` — **~100s, 16:9**

| Scene (frames) | Visual (Remotion) | VO | On-screen text |
|---|---|---|---|
| **Hook** 0–150 (5s) | Black. A phone rings, unanswered. Ring count ticks up. Amber. | "Every missed call is a buyer calling the next agent." | *ring… ring… ring…* |
| **Reality gap** 150–450 (10s) | `<RealityGap />`. Left: agent at a showing, three calls stacking, two → voicemail. | "You can't be everywhere. You're at a showing, the phone rings out, and by Monday that pre-approved buyer signed with someone else. You paid for that lead." | **You didn't lose the deal on price. You lost it on a missed call.** |
| **The wave** 450–750 (10s) | Map of the U.S. filling teal; a rising bar. | "And the fastest-growing group of buyers in America is Spanish-speaking — most of the net new homeowners in recent years. If your phone can't speak their language, you're invisible to them." | **Latinos = the majority of net new U.S. homeowner growth¹** |
| **Meet Orby** 750–1050 (10s) | Orby avatar/orb pulses; teal. | "Meet Orby — the AI receptionist MyOrbisAgents builds for agents. Orby answers every call, day or night, in English *and* Spanish." | **Orby catches. You close.** |
| **Phone sim** 1050–1800 (25s) | `<PhoneCallSim variant="rent-en" />` — full call + app panel filling live. | (call audio carries; music drops) | live captions + app: Lead → Qualified → Booked → Brief |
| **The app** 1800–2100 (10s) | `<AppCockpit />` — leads/calendar/brief populate on a phone in hand. | "Everything Orby catches shows up in your app — every lead, every showing, a brief on every buyer. You never type a thing. It fills itself." | **Your whole pipeline. In your pocket. Nothing typed.** |
| **Showing Brief** 2100–2400 (10s) | `<AppCockpit highlight="brief" />` — brief card: budget, pre-approval, timeline, must-haves. | "So you walk into every showing already knowing how to close — budget, pre-approval, timeline, what they want." | **Walk in ready.** |
| **Success** 2400–2700 (10s) | `<KpiCounter />` trio animating. | "Leads caught goes from forty percent to a hundred. Showings booked while you slept. Commissions you were losing — kept." | **40% → 100% leads caught · booked while you slept** |
| **CTA** 2700–3000 (10s) | `<CTACard />`. | "Don't take my word — try Orby yourself." | **Try Orby yourself · (929) 640-3810 · myorbisagents.com** |

¹ Source before release (NAR Hispanic Wealth Project / Urban Institute). Phrase as *net homeownership growth*, never "of all purchases."

---

## 2. MARKETING PIECE — FROM PERSONAL EXPERIENCE

`<Composition id="FounderStory" width={1920} height={1080} fps={30} durationInFrames={2250} />` — **~75s, 16:9** (first-person, authentic; low-fi warmth)

| Scene (frames) | Visual | VO (founder, first person) | On-screen text |
|---|---|---|---|
| **Cold open** 0–180 (6s) | Founder to camera / quiet office. | "For fifteen years I sold real estate and ran a mortgage branch." | *A true story.* |
| **The loss** 180–630 (15s) | Slow push. Amber tint. A phone lighting up, ignored. | "One day a buyer I'd worked with for weeks — pre-approved, ready to go — called while I was at a showing. I missed it. By the time I called back, she'd signed with another agent." | **Pre-approved. Ready. Gone.** |
| **The gut punch** 630–870 (8s) | Three receipts stack: client, commission, ad spend. | "I lost the client. I lost the commission. And I lost every dollar I'd spent to find her." | **One missed call. Three losses.** |
| **The decision** 870–1110 (8s) | Amber → teal shift. | "That's the day I decided no agent should lose a deal to a ringing phone again. So I built Orby." | **So I built Orby.** |
| **Phone sim** 1110–1710 (20s) | `<PhoneCallSim variant="rent-en" />` (trimmed to book + brief). | (call carries) | app fills: Booked · Brief ✓ |
| **The turn** 1710–1950 (8s) | `<AppCockpit />`. | "Now Orby answers every call — in English and Spanish — qualifies the buyer, books the showing, and hands me the details before I walk in. The call I missed? Orby would've caught it." | **The deal you're about to miss — Orby catches it.** |
| **CTA** 1950–2250 (10s) | `<CTACard />`. | "Don't take my word — try Orby yourself." | **Try Orby yourself · (929) 640-3810** |

---

## 3. TWO-MINUTE MARKETING PIECE

`<Composition id="TwoMinute" width={1920} height={1080} fps={30} durationInFrames={3600} />` — **~120s, 16:9** (the fullest cut — reality gap + wave + founder credibility + full sim + app + success)

| Scene (frames) | Visual | VO | On-screen text |
|---|---|---|---|
| **Hook** 0–210 (7s) | Ringing phone, unanswered, amber. | "Right now, a buyer is calling an agent who can't pick up. In a minute, they'll call the next one." | *ring… ring…* |
| **Reality gap** 210–660 (15s) | `<RealityGap />`, agent juggling. | "You're one person. You're at a showing, in a closing, asleep. The phone doesn't care. Every call that rings out is a commission walking out the door — and you already paid to make it ring." | **You lose more deals to voicemail than to price.** |
| **The wave** 660–1020 (12s) | Rising teal bar + map. | "And the biggest growth in home buying today is Spanish-speaking buyers — most of America's net new homeowners. Miss their language, miss the market." | **The growth in buying speaks Spanish.¹** |
| **Founder proof** 1020–1380 (12s) | Founder to camera, quick. | "I sold real estate for fifteen years. I lost a pre-approved buyer to a single missed call — client, commission, and ad spend, gone. So I built Orby." | **Built by an agent who lost the deal.** |
| **Orby** 1380–1620 (8s) | Orby orb pulses. | "Orby is your AI receptionist. Answers every call, 24/7, English and Spanish." | **Orby catches. You close.** |
| **Full phone sim** 1620–2520 (30s) | `<PhoneCallSim variant="rent-es" />` — the **Spanish** call, subtitled, app filling live. | (call carries; `<SpanishBadge />`) | subtitles + app: Lead → Qualified → Booked → Brief · Confirmation sent |
| **App + control** 2520–2880 (12s) | `<AppCockpit />` in hand. | "Every call, lead, and showing lands in your app — with a brief on every buyer. You see everything, you approve everything. Orby never goes behind your back. And you never type a word." | **You're in control. Nothing typed.** |
| **Success vision** 2880–3300 (14s) | Saturday scene + `<KpiCounter />`. | "Picture Saturday: you're mid-showing, three buyers call, Orby answers all three — one in Spanish — books two for Monday, briefs you on both. You never touched your phone. Monday, you close one." | **Booked while you showed. 40% → 100% caught.** |
| **CTA** 3300–3600 (10s) | `<CTACard />`. | "Don't take my word — try Orby yourself. Call the number. Ask about a listing. See what your buyers would get." | **Try Orby yourself · (929) 640-3810 · myorbisagents.com** |

---

## 4. FOUR VIDEO ADS

`<Composition id="Ad_X" width={1080} height={1920} fps={30} durationInFrames={…} />` — **9:16 vertical (social/paid), 15–25s each, built to work MUTED (text carries).** Each ends `<CTACard />` + VO tag "Try Orby yourself."

### Ad A — "Missed call = lost commission" (reality-gap punch) · 18s / 540 frames
| Frames | Visual | VO | On-screen text |
|---|---|---|---|
| 0–150 | Phone ringing out, amber, counter climbing | "This sound is costing you deals." | *ring… ring… ring…* |
| 150–360 | Voicemail → "signed with another agent" | "Every missed call is a buyer calling the next agent. You paid for that lead." | **Missed call = lost commission.** |
| 360–540 | `<CTACard />` | "Orby catches every one. Don't take my word — try it yourself." | **Orby catches. You close. · (929) 640-3810** |

### Ad B — Latino wedge · 20s / 600 frames
| Frames | Visual | VO | On-screen text |
|---|---|---|---|
| 0–180 | Rising teal bar / map | "The fastest-growing buyers in America are Spanish-speaking." | **Most net new homeowners: Latino.¹** |
| 180–420 | `<PhoneCallSim variant="rent-es" />` micro-cut (Orby answers in Spanish) + `<SpanishBadge />` | (Spanish call snippet) | **Your phone doesn't speak their language. Orby does.** |
| 420–600 | `<CTACard />` | "Try Orby yourself — in English or Spanish." | **Orby habla español. · (929) 640-3810** |

### Ad C — Speed / the sim · 22s / 660 frames
| Frames | Visual | VO | On-screen text |
|---|---|---|---|
| 0–120 | "You're busy." Agent at a showing. | "While you're closing one deal…" | **You're at a showing.** |
| 120–480 | `<PhoneCallSim variant="rent-en" />` fast-cut to booked + brief | "…Orby answered, qualified, and booked the next one. In under a minute." | app: **Booked · Brief ✓** |
| 480–660 | `<CTACard />` | "Don't take my word — try Orby yourself." | **Booked while you worked. · (929) 640-3810** |

### Ad D — Showing Brief · 20s / 600 frames
| Frames | Visual | VO | On-screen text |
|---|---|---|---|
| 0–180 | Agent walking to a door, unsure | "Most agents walk into a showing knowing a name." | **A name. That's it.** |
| 180–420 | `<AppCockpit highlight="brief" />` brief card builds | "You'll walk in knowing their budget, their pre-approval, their timeline, what they want — because Orby already asked." | **Walk in ready to close.** |
| 420–600 | `<CTACard />` | "Try Orby yourself." | **Orby briefs you before you show. · (929) 640-3810** |

---

## 5. HOMEPAGE VIDEO

`<Composition id="HomepageHero" width={1920} height={1080} fps={30} durationInFrames={1050} />` — **~35s, 16:9, autoplay-muted-first** (on-screen text must carry the whole story with no sound; VO optional for unmuted). Loops cleanly.

| Frames | Visual | On-screen text (carries muted) | VO (optional) |
|---|---|---|---|
| 0–120 (4s) | Amber ringing phone | **Missed call = lost buyer.** | "A missed call is a lost buyer." |
| 120–300 (6s) | Amber → teal; Orby orb | **Orby catches. You close.** | "Orby catches every call — English and Spanish." |
| 300–660 (12s) | `<PhoneCallSim variant="rent-en" />` compact + app panel | **Answers · qualifies · books — while you work.** `<SpanishBadge />` | (call snippet) |
| 660–870 (7s) | `<AppCockpit />` in hand | **Every lead + a Showing Brief, in your pocket. Nothing typed.** | "Your whole pipeline, briefed, in your pocket." |
| 870–1050 (6s) | `<CTACard />` | **Try Orby yourself → (929) 640-3810 · myorbisagents.com** | "Don't take my word — try Orby yourself." |

---

## Production notes / next steps

1. **Remotion scaffold** — a `remotion/` project with the shared components
   above, one `<Composition>` per piece, and a `Root.tsx` registering all. VO as
   audio tracks (`<Audio>`), or captions-only for muted cuts. I can scaffold this
   next.
2. **Assets needed:** Orby orb/logo, app-cockpit UI frames (can render live from
   the real app), VO recordings (or TTS scratch), music bed.
3. **Bilingual (mandatory):** produce the Spanish master of each script + a
   Spanish VO/caption pass. The `rent-es` phone sim is drafted; the rest of the
   ES scripts are the immediate paired follow-up.
4. **Source the stat (¹)** before any piece ships — NAR Hispanic Wealth Project /
   Urban Institute; phrase as *net homeownership growth*.
5. **Number discipline:** all CTAs use **(929) 640-3810** (instant demo line, no
   PIN). Not the 470 cockpit-PIN line.

---

# Spanish Masters (ES) — Guiones en español

Contrapartes en español de los 5 masters en inglés. Mismas composiciones
Remotion, mismos rangos de frames, misma estructura de escenas — solo cambian
el VO y el texto en pantalla (la dirección visual/Remotion queda en inglés:
es dirección de producción, no contenido para el usuario). Español
latinoamericano, tuteo, voz de marketing SaaS. Tagline: **"Orby atiende. Tú
cierras."** CTA de cierre en todas las piezas: **"No me creas a mí — pruébalo
tú mismo. Llama al (929) 640-3810 o habla con Orby en myorbisagents.com."**

**Sim telefónico:** los masters ES usan el variant `rent-es` (ya esbozado
arriba) en lugar de `rent-en`. Beats completos alineados con `rent-en`:

**`rent-es` (beats completos):**
- **Orby:** "Hola, hablas con Orby, de John Brown en Austin Realtors — *and I also speak English, if you prefer.* ¿En qué te puedo ayudar?" → `<SpanishBadge />` (en los cortes ES, el chip se invierte: "I also speak English")
- **Caller:** "Hola, vi la casa en renta de 3 recámaras cerca del campus."
- **Orby:** "Claro — $3,100 al mes, patio cercado, lavadora y secadora, a pasos del campus. ¿Quieres venir a verla? ¿Para cuándo esperas mudarte?" → app: **Lead creado**
- **Caller:** "A principios del próximo mes."
- **Orby:** "Perfecto. ¿Tienes mascotas, y más o menos cuántas personas se mudan?" → app: **Calificando…**
- **Caller:** "Solo yo y un perro."
- **Orby:** "Listo. Lo más pronto que tengo es hoy a las 9, o mañana a las 10 — ¿cuál te queda?" → app: **Ofreciendo el primer horario**
- **Caller:** "Mañana a las 10."
- **Orby:** "Agendado. Te mando la confirmación por mensaje y le paso a John un resumen para que llegue preparado. ¿Algo más?" → app: **Cita agendada · Confirmación enviada · Resumen ✓**

**Nomenclatura:** el feature "Showing Brief" se dice **"Resumen de Cita"** (o
"resumen del comprador" en VO). Los estados de app en pantalla van en español:
Lead → Calificado → Agendado → Resumen ✓.

---

## 1. FULL EXPLAINER — ES

`<Composition id="Explainer" width={1920} height={1080} fps={30} durationInFrames={3000} />` — **~100s, 16:9**

| Escena (frames) | Visual (Remotion) | VO | Texto en pantalla |
|---|---|---|---|
| **Hook** 0–150 (5s) | Black. A phone rings, unanswered. Ring count ticks up. Amber. | "Cada llamada perdida es un comprador llamando al siguiente agente." | *ring… ring… ring…* |
| **Reality gap** 150–450 (10s) | `<RealityGap />`. Left: agent at a showing, three calls stacking, two → voicemail. | "No puedes estar en todas partes. Estás en una cita, el teléfono suena sin respuesta, y para el lunes ese comprador pre-aprobado ya firmó con otro agente. Y tú pagaste por ese lead." | **No perdiste el trato por el precio. Lo perdiste por una llamada perdida.** |
| **The wave** 450–750 (10s) | Map of the U.S. filling teal; a rising bar. | "Y el grupo de compradores que más crece en Estados Unidos habla español — la mayoría del crecimiento neto de nuevos propietarios en los últimos años. Si tu teléfono no habla su idioma, eres invisible para ellos." | **Latinos = la mayoría del crecimiento neto de propietarios en EE. UU.¹** |
| **Meet Orby** 750–1050 (10s) | Orby avatar/orb pulses; teal. | "Conoce a Orby — recepcionista de IA que MyOrbisAgents construye para agentes. Orby contesta cada llamada, de día o de noche, en inglés *y* en español." | **Orby atiende. Tú cierras.** |
| **Phone sim** 1050–1800 (25s) | `<PhoneCallSim variant="rent-es" />` — full call + app panel filling live. | (el audio de la llamada lleva la escena; la música baja) | subtítulos en vivo + app: Lead → Calificado → Agendado → Resumen |
| **The app** 1800–2100 (10s) | `<AppCockpit />` — leads/calendar/brief populate on a phone in hand. | "Todo lo que Orby atiende aparece en tu app — cada lead, cada cita, un resumen de cada comprador. Nunca escribes nada. Se llena solo." | **Todo tu pipeline. En tu bolsillo. Sin escribir nada.** |
| **Showing Brief** 2100–2400 (10s) | `<AppCockpit highlight="brief" />` — brief card: budget, pre-approval, timeline, must-haves. | "Así entras a cada cita ya sabiendo cómo cerrar — presupuesto, pre-aprobación, plazos, qué es lo que buscan." | **Llega preparado.** |
| **Success** 2400–2700 (10s) | `<KpiCounter />` trio animating. | "Los leads captados pasan del cuarenta por ciento al cien. Citas agendadas mientras dormías. Las comisiones que estabas perdiendo — se quedan contigo." | **40% → 100% de leads captados · agendado mientras dormías** |
| **CTA** 2700–3000 (10s) | `<CTACard />`. | "No me creas a mí — pruébalo tú mismo." | **Pruébalo tú mismo · (929) 640-3810 · myorbisagents.com** |

¹ Verificar la fuente antes del lanzamiento (NAR Hispanic Wealth Project / Urban Institute). Frasear siempre como *crecimiento neto de propietarios*, nunca "de todas las compras."

---

## 2. MARKETING PIECE — FROM PERSONAL EXPERIENCE — ES

`<Composition id="FounderStory" width={1920} height={1080} fps={30} durationInFrames={2250} />` — **~75s, 16:9** (first-person, authentic; low-fi warmth)

| Escena (frames) | Visual | VO (fundador, primera persona) | Texto en pantalla |
|---|---|---|---|
| **Cold open** 0–180 (6s) | Founder to camera / quiet office. | "Durante quince años vendí bienes raíces y dirigí una sucursal hipotecaria." | *Una historia real.* |
| **The loss** 180–630 (15s) | Slow push. Amber tint. A phone lighting up, ignored. | "Un día, una compradora con la que llevaba semanas trabajando — pre-aprobada, lista para comprar — llamó mientras yo estaba en una cita. No contesté. Cuando le devolví la llamada, ya había firmado con otro agente." | **Pre-aprobada. Lista. Perdida.** |
| **The gut punch** 630–870 (8s) | Three receipts stack: client, commission, ad spend. | "Perdí a la clienta. Perdí la comisión. Y perdí cada dólar que había invertido en encontrarla." | **Una llamada perdida. Tres pérdidas.** |
| **The decision** 870–1110 (8s) | Amber → teal shift. | "Ese día decidí que ningún agente debería volver a perder un trato por un teléfono sonando. Así que construí a Orby." | **Así que construí a Orby.** |
| **Phone sim** 1110–1710 (20s) | `<PhoneCallSim variant="rent-es" />` (trimmed to book + brief). | (la llamada lleva la escena) | app se llena: Agendado · Resumen ✓ |
| **The turn** 1710–1950 (8s) | `<AppCockpit />`. | "Ahora Orby contesta cada llamada — en inglés y en español — califica al comprador, agenda la cita y me entrega los detalles antes de entrar. ¿La llamada que perdí? Orby la habría atendido." | **El trato que estás a punto de perder — Orby lo atiende.** |
| **CTA** 1950–2250 (10s) | `<CTACard />`. | "No me creas a mí — pruébalo tú mismo." | **Pruébalo tú mismo · (929) 640-3810** |

---

## 3. TWO-MINUTE MARKETING PIECE — ES

`<Composition id="TwoMinute" width={1920} height={1080} fps={30} durationInFrames={3600} />` — **~120s, 16:9** (the fullest cut — reality gap + wave + founder credibility + full sim + app + success)

| Escena (frames) | Visual | VO | Texto en pantalla |
|---|---|---|---|
| **Hook** 0–210 (7s) | Ringing phone, unanswered, amber. | "Ahora mismo, un comprador está llamando a un agente que no puede contestar. En un minuto, llamará al siguiente." | *ring… ring…* |
| **Reality gap** 210–660 (15s) | `<RealityGap />`, agent juggling. | "Eres una sola persona. Estás en una cita, en un cierre, dormido. Al teléfono no le importa. Cada llamada que suena sin respuesta es una comisión saliendo por la puerta — y tú ya pagaste para que ese teléfono sonara." | **Pierdes más tratos por el buzón de voz que por el precio.** |
| **The wave** 660–1020 (12s) | Rising teal bar + map. | "Y el mayor crecimiento en la compra de vivienda hoy viene de compradores que hablan español — la mayoría del crecimiento neto de nuevos propietarios en Estados Unidos. Si pierdes su idioma, pierdes el mercado." | **El crecimiento en compra de vivienda habla español.¹** |
| **Founder proof** 1020–1380 (12s) | Founder to camera, quick. | "Vendí bienes raíces durante quince años. Perdí a una compradora pre-aprobada por una sola llamada perdida — clienta, comisión e inversión publicitaria, todo perdido. Así que construí a Orby." | **Creado por un agente que perdió el trato.** |
| **Orby** 1380–1620 (8s) | Orby orb pulses. | "Orby es tu recepcionista de IA. Contesta cada llamada, 24/7, en inglés y en español." | **Orby atiende. Tú cierras.** |
| **Full phone sim** 1620–2520 (30s) | `<PhoneCallSim variant="rent-es" />` — the **Spanish** call, app filling live. | (la llamada lleva la escena; `<SpanishBadge />`) | subtítulos en español + app: Lead → Calificado → Agendado → Resumen · Confirmación enviada |
| **App + control** 2520–2880 (12s) | `<AppCockpit />` in hand. | "Cada llamada, cada lead y cada cita aterriza en tu app — con un resumen de cada comprador. Tú lo ves todo, tú apruebas todo. Orby nunca actúa a tus espaldas. Y tú nunca escribes ni una palabra." | **Tú tienes el control. Sin escribir nada.** |
| **Success vision** 2880–3300 (14s) | Saturday scene + `<KpiCounter />`. | "Imagina el sábado: estás en plena cita, llaman tres compradores, Orby contesta los tres — uno en español — agenda dos para el lunes y te prepara el resumen de ambos. Nunca tocaste tu teléfono. El lunes, cierras uno." | **Agendado mientras mostrabas. 40% → 100% captados.** |
| **CTA** 3300–3600 (10s) | `<CTACard />`. | "No me creas a mí — pruébalo tú mismo. Llama al número. Pregunta por una propiedad. Mira lo que recibirían tus compradores." | **Pruébalo tú mismo · (929) 640-3810 · myorbisagents.com** |

---

## 4. FOUR VIDEO ADS — ES

`<Composition id="Ad_X" width={1080} height={1920} fps={30} durationInFrames={…} />` — **9:16 vertical (social/pauta), 15–25s cada uno, hechos para funcionar EN SILENCIO (el texto carga la historia).** Cada uno cierra con `<CTACard />` + tag de VO "Pruébalo tú mismo."

### Ad A — "Llamada perdida = comisión perdida" (golpe reality-gap) · 18s / 540 frames
| Frames | Visual | VO | Texto en pantalla |
|---|---|---|---|
| 0–150 | Phone ringing out, amber, counter climbing | "Este sonido te está costando tratos." | *ring… ring… ring…* |
| 150–360 | Voicemail → "signed with another agent" | "Cada llamada perdida es un comprador llamando al siguiente agente. Tú pagaste por ese lead." | **Llamada perdida = comisión perdida.** |
| 360–540 | `<CTACard />` | "Orby atiende todas. No me creas a mí — pruébalo tú mismo." | **Orby atiende. Tú cierras. · (929) 640-3810** |

### Ad B — El wedge latino · 20s / 600 frames
| Frames | Visual | VO | Texto en pantalla |
|---|---|---|---|
| 0–180 | Rising teal bar / map | "Los compradores que más crecen en Estados Unidos hablan español." | **La mayoría del crecimiento neto de propietarios: latinos.¹** |
| 180–420 | `<PhoneCallSim variant="rent-es" />` micro-cut (Orby answers in Spanish) + `<SpanishBadge />` | (fragmento de la llamada en español) | **Tu teléfono no habla su idioma. Orby sí.** |
| 420–600 | `<CTACard />` | "Pruébalo tú mismo — en inglés o en español." | **Orby habla español. · (929) 640-3810** |

### Ad C — Velocidad / el sim · 22s / 660 frames
| Frames | Visual | VO | Texto en pantalla |
|---|---|---|---|
| 0–120 | "You're busy." Agent at a showing. | "Mientras tú cierras un trato…" | **Estás en una cita.** |
| 120–480 | `<PhoneCallSim variant="rent-es" />` fast-cut to booked + brief | "…Orby contestó, calificó y agendó el siguiente. En menos de un minuto." | app: **Agendado · Resumen ✓** |
| 480–660 | `<CTACard />` | "No me creas a mí — pruébalo tú mismo." | **Agendado mientras trabajabas. · (929) 640-3810** |

### Ad D — Resumen de Cita · 20s / 600 frames
| Frames | Visual | VO | Texto en pantalla |
|---|---|---|---|
| 0–180 | Agent walking to a door, unsure | "La mayoría de los agentes entra a una cita sabiendo solo un nombre." | **Un nombre. Nada más.** |
| 180–420 | `<AppCockpit highlight="brief" />` brief card builds | "Tú vas a entrar sabiendo su presupuesto, su pre-aprobación, sus plazos y qué es lo que buscan — porque Orby ya lo preguntó." | **Entra listo para cerrar.** |
| 420–600 | `<CTACard />` | "Pruébalo tú mismo." | **Orby te prepara antes de cada cita. · (929) 640-3810** |

---

## 5. HOMEPAGE VIDEO — ES

`<Composition id="HomepageHero" width={1920} height={1080} fps={30} durationInFrames={1050} />` — **~35s, 16:9, autoplay-muted-first** (on-screen text must carry the whole story with no sound; VO optional for unmuted). Loops cleanly.

| Frames | Visual | Texto en pantalla (carga la historia en silencio) | VO (opcional) |
|---|---|---|---|
| 0–120 (4s) | Amber ringing phone | **Llamada perdida = comprador perdido.** | "Una llamada perdida es un comprador perdido." |
| 120–300 (6s) | Amber → teal; Orby orb | **Orby atiende. Tú cierras.** | "Orby atiende cada llamada — en inglés y en español." |
| 300–660 (12s) | `<PhoneCallSim variant="rent-es" />` compact + app panel | **Contesta · califica · agenda — mientras tú trabajas.** `<SpanishBadge />` | (fragmento de la llamada) |
| 660–870 (7s) | `<AppCockpit />` in hand | **Cada lead + un Resumen de Cita, en tu bolsillo. Sin escribir nada.** | "Todo tu pipeline, con resumen, en tu bolsillo." |
| 870–1050 (6s) | `<CTACard />` | **Pruébalo tú mismo → (929) 640-3810 · myorbisagents.com** | "No me creas a mí — pruébalo tú mismo." |
