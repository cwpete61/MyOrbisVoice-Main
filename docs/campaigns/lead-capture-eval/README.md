# Lead Capture Evaluation — Campaign

The social campaign that drives business owners to the **Lead Capture Score** quiz → free evaluation + report (beta). This is the top of the eval → report → signup loop in [marketing-plan.md](../../marketing-plan.md).

## Files
- [`lead-capture-score-quiz.md`](lead-capture-score-quiz.md) — the 8-question self-scoring quiz: questions, weights, result tiers, cost-of-leak calculator, consent line, beta offer. EN + ES. *(Copy only — wire into your quiz tool / landing page.)*
- [`campaign-en.md`](campaign-en.md) — per-platform kit (FB, X, LinkedIn, TikTok, YouTube): primary post + native poll + video scripts + hashtags.
- [`campaign-es.md`](campaign-es.md) — Spanish mirror (Latin American, informal *tú*).

## How the funnel works
```
social post / poll  →  Lead Capture Score quiz (2 min)  →  score + cost-of-leak shown
   →  "Get my free report" (beta, capped)  →  lead captured  →  eval run + report delivered
   →  report opens the MyOrbisVoice conversation  →  signup
```
One destination. Every asset points at the quiz — don't split traffic across multiple links.

## Decisions baked in
| Decision | Choice |
|---|---|
| Audience | Business owners (direct) |
| Quiz format | Copy + questions only |
| Scope | Full kit per platform |
| Tone | Provocative pattern-interrupt → written at style-guide **Tier 3 (Direct)** |
| Languages | English + Spanish (ship together) |

## Before you post — checklist
1. **Stand up the quiz** and get its live URL.
2. **Replace `[QUIZ-LINK]`** in both campaign files.
3. **Set the beta cap `[N]`** in the quiz offer to a real monthly number — and hold it. Fake scarcity burns trust (style-guide rule #3).
4. **Confirm the consent line** is on the report-request form (call-recording / two-party-consent compliance). Have legal sign off if you'll record calls.
5. **Add citation chips** to any external statistic you introduce. The quiz uses the owner's own numbers on purpose, so nothing is unsourced — keep it that way.

## UTM scheme (so you can read eval→signup attribution)
```
[QUIZ-LINK]?utm_source=<platform>&utm_medium=social&utm_campaign=lead_capture_eval&utm_content=<asset>&utm_term=<lang>
```
- `utm_source`: facebook | x | linkedin | tiktok | youtube
- `utm_content`: post | poll | reel | short | video
- `utm_term`: en | es

Example: `?utm_source=linkedin&utm_medium=social&utm_campaign=lead_capture_eval&utm_content=post&utm_term=en`

## Suggested cadence (organic, no paid — per the plan)
- **Week 1:** launch the poll on each platform (low-friction, self-identifying). Pin the quiz link in the top comment / bio.
- **Week 1–2:** primary post per platform, 2–3 days after the poll.
- **Week 2:** TikTok + YouTube Short.
- **Week 3:** YouTube long-form (also the asset partners can embed).
- **Ongoing:** rotate the hook bank + verticalize (dental / legal / home / fitness / beauty) so the same idea stays fresh.

## Metric that matters
Track **eval → signup** end to end (quiz completion → report requested → report opened → signup → paid). That conversion rate is the gate for everything that follows, including paid spend.

## Partner reuse
Everything here doubles as a partner asset: partners can post the same copy under their own handles and run the quiz/eval as the conversation starter their commission loop depends on. (Partner-recruiting variants weren't built — this set targets business owners directly, per the scope decision. Say the word and I'll add a partner track.)
