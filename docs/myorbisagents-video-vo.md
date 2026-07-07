# MyOrbisAgents — Video Voiceover Scripts (English)

Voiceover scripts for the Remotion video suite in `remotion/src/compositions/`.
Timings are taken from the actual `<Scene from/dur>` values at 30 fps.

**Conventions**

- One VO line per scene beat. `[~Ns]` after a line is the rough spoken length; the scene window is shown per beat.
- During phone-demo scenes, Orby's in-scene call audio is the star. The narrator gets a short lead-in, then goes silent while the call plays. Marked `[call audio plays]`.
- Spanish in-scene dialogue is Orby's, not the narrator's. Narrator stays English (Spanish VO is a later pass).
- No em dashes in spoken lines (TTS engine). Commas and periods only.
- Every piece ends on the standard close: "Don't take my word for it. Try Orby yourself. Call (929) 640-3810."
- Phone number for TTS: render as "nine two nine, six four zero, three eight one zero" if the engine reads digits poorly.

**Voice assignments (OpenAI TTS)**

| Piece | Voice | Why |
|---|---|---|
| Explainer | `echo` | Confident male narrator. Matches the punchy, plain-spoken swagger of the site explainer without colliding with the founder's onyx. |
| FounderStory | `onyx` | Deep male, first person, per the founder's instruction. |
| TwoMinute | `echo` | It is a cut-down of the Explainer. Same narrator keeps one brand voice. |
| Five outcome-ads | `nova` | Warm, bright female. Cuts through social feeds and gives the paid placements a distinct sound from the long-form narrator. Fully bilingual (EN + ES clips per line). |
| HomepageHero | `echo` | Plays on the site next to the Explainer. Same voice, same brand. |

---

## 1. Explainer (~180s, 14 beats) — voice: `echo`

| # | Beat | Scene window | VO line |
|---|---|---|---|
| 1 | Hook, missed call | 0:00–0:06 (6s) | "That ringing? That's a buyer, ready to move. And you're mid-showing." [~5s] |
| 2 | Reality gap | 0:06–0:18 (12s) | "Here's the gap nobody talks about. Buyers go with the first agent who responds. Seventy-eight percent of them. Not the best agent. The first one." [~11s] |
| 3 | Cost of a missed call | 0:18–0:28 (10s) | "One missed call can be a ten thousand dollar commission, handed to whoever picked up." [~7s] |
| 4 | Latino growth wave | 0:28–0:40 (12s) | "And the fastest growing buyers in America speak Spanish. If you can't answer in their language, someone else will." [~9s] |
| 5 | Meet Orby | 0:40–0:50 (10s) | "Meet Orby. Your AI inside sales agent. Never sleeps. Never misses." [~6s] |
| 6 | Phone demo, English | 0:50–1:18 (28s) | "Listen to Orby take a live buyer call." [~3s] [call audio plays] |
| 7 | Bilingual proof, Spanish call | 1:18–1:38 (20s) | "Same lead calls in Spanish? Orby switches instantly. Fluent, natural, no hold music." [~7s] [Spanish call audio plays] |
| 8 | The app fills itself | 1:38–1:50 (12s) | "While Orby talks, your app fills itself. Name, number, budget, timeline. Captured, not scribbled." [~9s] |
| 9 | Showing Brief | 1:50–2:02 (12s) | "Before every appointment, Orby hands you a Showing Brief. Who they are, what they want, and what it takes to close." [~10s] |
| 10 | You're in control | 2:02–2:12 (10s) | "You stay in control. Set the rules, review every call, take over any time." [~7s] |
| 11 | Will it replace you? No. | 2:12–2:22 (10s) | "Will Orby replace you? No. Orby catches. You close." [~6s] |
| 12 | Founder credibility | 2:22–2:32 (10s) | "Built by an agent who lost real deals to voicemail. Not a tech company guessing." [~7s] |
| 13 | Success / KPIs | 2:32–2:48 (16s) | "Every call caught. Showings booked while you slept. Commissions kept instead of lost. That's the scoreboard that matters." [~10s] |
| 14 | CTA | 2:48–3:00 (12s) | "Don't take my word for it. Try Orby yourself. Call (929) 640-3810, or visit myorbisagents.com." [~9s] |

---

## 2. FounderStory (~75s, 7 beats) — voice: `onyx` (first-person founder)

| # | Beat | Scene window | VO line |
|---|---|---|---|
| 1 | Cold open | 0:00–0:06 (6s) | "For fifteen years, I sold real estate. Nights, weekends, all of it." [~5s] |
| 2 | The loss | 0:06–0:21 (15s) | "Then one afternoon, a pre-approved buyer called me. I was in a showing. She hit my voicemail, hung up, and dialed the next agent on her list." [~12s] |
| 3 | The gut punch | 0:21–0:29 (8s) | "I lost the client, the commission, and the money I spent to make that phone ring." [~7s] |
| 4 | The decision | 0:29–0:37 (8s) | "That was the last one I let get away. So I built Orby." [~5s] |
| 5 | Phone demo | 0:37–0:57 (20s) | "This is Orby, answering a buyer, live." [~3s] [call audio plays] |
| 6 | The turn | 0:57–1:05 (8s) | "Now every call gets caught, even the two a.m. ones. Orby catches. I close." [~7s] |
| 7 | CTA | 1:05–1:15 (10s) | "Don't take my word for it. Try Orby yourself. Call (929) 640-3810." [~7s] |

---

## 3. TwoMinute (~120s, 9 beats) — voice: `echo`

| # | Beat | Scene window | VO line |
|---|---|---|---|
| 1 | Hook | 0:00–0:07 (7s) | "Hear that? That's a commission calling. And you can't pick up." [~5s] |
| 2 | Reality gap | 0:07–0:22 (15s) | "Seventy-eight percent of buyers work with the first agent who responds. Under five minutes, then the lead goes cold. You can't answer mid-showing, driving, or asleep. But somebody has to." [~13s] |
| 3 | Latino wave | 0:22–0:34 (12s) | "Spanish-speaking buyers are the fastest growing market in real estate. Answer in their language, or lose them to someone who does." [~10s] |
| 4 | Founder proof | 0:34–0:46 (12s) | "Orby was built by a fifteen year agent who got tired of losing deals to voicemail." [~7s] |
| 5 | Meet Orby | 0:46–0:54 (8s) | "Meet Orby. Your AI inside sales agent." [~4s] |
| 6 | Spanish phone demo | 0:54–1:24 (30s) | "Here's Orby taking a rental lead. In Spanish. Live." [~4s] [Spanish call audio plays] |
| 7 | App + control | 1:24–1:36 (12s) | "Every call lands in your app, transcribed and qualified. You set the rules. You stay in charge." [~8s] |
| 8 | Success vision | 1:36–1:50 (14s) | "Picture Monday morning. Two showings booked while you slept, briefs ready, nothing missed. That's what responsive looks like." [~10s] |
| 9 | CTA | 1:50–2:00 (10s) | "Don't take my word for it. Try Orby yourself. Call (929) 640-3810." [~7s] |

---

## 4. Five outcome-ads (vertical 9:16, 21–31s each) — voice: `nova`

Each ad = **one agent outcome**, built on PAS (loss-hook → agitate in
dollars → outcome-close) → shared CTA. **Fully bilingual narration** —
every line has an EN and an ES clip (`adN-MM-en.mp3` / `adN-MM-es.mp3`),
plus `cta-en` / `cta-es`. The Spanish-speaking calls stay `rent-es`
(audible in both cuts). Comp ids: `Ad-NeverMiss`, `Ad-Speed`, `Ad-Ready`,
`Ad-Bilingual`, `Ad-TimeBack` (+ `-ES`).

### Ad 1 — Never Miss (outcome: every lead answered, 24/7)

| # | Beat | VO line (EN) |
|---|---|---|
| 1 | Loss + agitate | "That ring? A buyer, ready to move — and you're mid-showing. Miss it, and they call the next agent. There goes a ten-thousand-dollar commission." |
| 2 | Outcome | "Orby answers every call. Day, night, mid-showing. You never miss a lead again." |
| 3 | CTA (`cta`) | "Don't take my word for it. Try Orby yourself. Call (929) 640-3810. Or visit myorbisagents.com." |

### Ad 2 — Speed Wins (outcome: be the first responder — the 78%)

| # | Beat | VO line (EN) |
|---|---|---|
| 1 | Stat (animated 78%) | "Seventy-eight percent of buyers go with the first agent who responds. Not the best agent. The first." |
| 2 | Agitate + proof (sales call) | "Miss the window, lose the deal. Orby answers on the first ring. Listen." [sales call audio plays] |
| 3 | CTA (`cta`) | shared CTA |

### Ad 3 — Walk In Ready (outcome: pre-qualified + Showing Brief)

| # | Beat | VO line (EN) |
|---|---|---|
| 1 | Problem | "Most agents walk into a showing knowing a name. Guessing the budget, the timeline, whether the buyer's even pre-approved." |
| 2 | Outcome (app + brief) | "Orby hands you a Showing Brief before you knock. Budget, pre-approval, must-haves. Walk in ready to close." |
| 3 | CTA (`cta`) | shared CTA |

### Ad 4 — Bilingual (outcome: capture the Spanish buyers you're losing)

| # | Beat | VO line (EN) |
|---|---|---|
| 1 | Problem | "The fastest-growing buyers in America speak Spanish. Your phone doesn't. So they hang up and call someone who does." |
| 2 | Proof (Spanish call) | "Orby switches to Spanish instantly. Fluent. Natural. Listen." [Spanish call audio plays] |
| 3 | CTA (`cta`) | shared CTA |

### Ad 5 — Time Back (outcome: stop being chained to the phone)

| # | Beat | VO line (EN) |
|---|---|---|
| 1 | Problem | "You became an agent to close deals — not to babysit a phone. But every call you miss, mid-dinner, mid-showing, is a deal gone." |
| 2 | Outcome (app fills itself) | "Orby answers, qualifies the buyer, books the showing. You get your time back. And you still close." |
| 3 | CTA (`cta`) | shared CTA |

---

## 5. HomepageHero (~35s, 5 beats) — voice: `echo`

| # | Beat | Scene window | VO line |
|---|---|---|---|
| 1 | Missed call | 0:00–0:04 (4s) | "A buyer is calling. You're busy." [~3s] |
| 2 | Orby catches | 0:04–0:10 (6s) | "Orby catches. You close." [~3s] |
| 3 | Phone demo | 0:10–0:22 (12s) | "Listen. That's Orby, answering live, in English and Spanish." [~5s] [call audio plays] |
| 4 | App | 0:22–0:29 (7s) | "Every lead lands in your app, qualified and booked." [~5s] |
| 5 | CTA | 0:29–0:35 (6s) | "Don't take my word for it. Try Orby yourself. Call (929) 640-3810." [~7s] ⚠ tight |

---

## Production notes

- **Tight CTA windows (⚠).** The mandated closing line plus the phone number runs about 7 seconds spoken naturally. The four ads and the HomepageHero give it a 6-second scene. Options, in order of preference: (a) render the CTA at TTS `speed: 1.1`, (b) start the CTA line about 1 second before the CTA card cuts in, over the tail of the prior scene, (c) extend each CTA scene by 30–45 frames in the composition. Everything else fits its window with breathing room.
- **Phone-demo ducking.** Where a narrator lead-in overlaps a `PhoneCallSim` scene, duck the call audio until the lead-in ends (about 3–5s in), then bring Orby's call up full. The demo is the proof, let it play clean.
- **Number style.** If a chosen voice reads "(929) 640-3810" awkwardly, pass it to TTS as "nine two nine, six four zero, three eight one zero."
- **Explainer beat 13 (KPIs).** The line paces with the three `KpiCounter` animations: "every call caught" on the 100% counter, "booked while you slept" on the second, "commissions kept" on the amber one.
