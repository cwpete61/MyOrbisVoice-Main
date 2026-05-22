// Partner (Affiliate) Agreement content — bilingual.
//
// The legal body lives here as markdown (not in the i18n JSON dictionaries) so
// the ~6k-word contract doesn't bloat every page's translation payload. The
// Contract page renders it with <AgreementBody>. UI chrome (checkbox label,
// buttons, signed banner, the ES "English prevails" disclaimer) stays in the
// i18n dictionaries under `partnerContract.*`.
//
// Reconciled with the platform's actual payout structure (do not drift):
//   • Commission rate = AffiliateSettings.commissionRatePct, set in Admin →
//     System Settings and shown live in the partner dashboard. Injected here.
//   • 30-day holdback (recurring renewals skip the hold).
//   • Payouts processed on the 1st and 15th, business-day adjusted.
//   • Minimum payout threshold = AffiliateSettings.minPayoutCents (shown live).
//   • Stripe (Stripe Connect) handles payout processing, identity/bank
//     verification, tax-form collection (W-9 / W-8BEN), and 1099 reporting.
// See docs/24-affiliate-ledger-spec.md and affiliate.service.ts.

export interface AgreementVars {
  commissionRatePct: number
  minPayout: string // formatted, e.g. "$50.00"
}

const ENTITY_NAME = 'MyOrbisResults, a sole proprietorship owned by Crawford Peterson Sr.'
const ENTITY_SHORT = 'MyOrbisResults'
const ENTITY_ADDRESS = '716 Washington St, Suite 2, Allentown, PA 18102'
const GOVERNING_STATE = 'Pennsylvania'
const VENUE = 'Lehigh County, Pennsylvania'
const YEAR = '2026'

export function getAgreementMarkdown(locale: 'en' | 'es', v: AgreementVars): string {
  const rate = `${v.commissionRatePct}%`
  return locale === 'es' ? buildEs(rate, v.minPayout) : buildEn(rate, v.minPayout)
}

function buildEn(rate: string, minPayout: string): string {
  return `# ${ENTITY_SHORT} Affiliate Agreement

This Affiliate Agreement (“Agreement”) governs Your application for, and any subsequent participation in, the ${ENTITY_SHORT} Affiliate Program. By checking the acknowledgement box, typing Your legal name, and submitting this Agreement, by submitting an affiliate application, receiving an affiliate link, or otherwise participating in the Affiliate Program, You indicate that You have read and understood this Agreement and agree to be bound by its terms.

${ENTITY_SHORT} may offer You an opportunity to become an independent ${ENTITY_SHORT} Affiliate, through which You may earn referral commissions for approved sales of ${ENTITY_SHORT} products, services, subscriptions, accounts, software, implementation services, or related offers, including but not limited to MyOrbisVoice, MyOrbisLocal, MyOrbisWeb, and any other current or future products or services offered under the ${ENTITY_SHORT} brand family.

${ENTITY_SHORT} reserves the sole and exclusive right to approve or reject any Affiliate, determine the commission structure for each offer, modify commission rates, deny or revoke commissions, and administer the Affiliate Program in accordance with this Agreement. Affiliate compensation is further described below. ${ENTITY_SHORT}’ Terms of Service, Privacy Policy, Acceptable Use Policy, and any applicable product-specific terms also apply to You in Your role as an Affiliate unless expressly modified by this Agreement.

---

## SECTION 1 — PARTIES

All references to “${ENTITY_SHORT},” “Company,” “we,” “us,” or “our” mean and refer to **${ENTITY_NAME}**, located at ${ENTITY_ADDRESS}, the operating business associated with MyOrbisVoice, MyOrbisLocal, MyOrbisWeb, and related services.

All references to “You,” “Your,” or “Affiliate” mean and refer to the person, business, or legal entity that applies for, accepts, or participates in the ${ENTITY_SHORT} Affiliate Program.

${ENTITY_SHORT} and You are each referred to herein as a “Party” and collectively as the “Parties.”

You agree to notify ${ENTITY_SHORT} in writing if Your legal name, business name, tax classification, ownership, payment information, or account ownership changes within twenty-four (24) hours of such change. You certify that all information provided to ${ENTITY_SHORT} is truthful, accurate, complete, and not misleading. Notice of such changes must be sent to affiliates@myorbisresults.com or any other affiliate-support address designated by ${ENTITY_SHORT}.

---

## SECTION 2 — APPLICATION

You agree to provide all information requested by ${ENTITY_SHORT} in connection with Your Affiliate application and Your continued participation in the Affiliate Program. You affirm that all information You provide is truthful, accurate, current, and complete, without material omission.

${ENTITY_SHORT} retains sole and exclusive discretion to determine whether You qualify for participation in the Affiliate Program. Not every person, company, creator, agency, consultant, reseller, or service provider who applies will be approved.

${ENTITY_SHORT} may reject, suspend, or terminate an Affiliate application or account for any reason, including but not limited to incomplete information, inaccurate information, prior compliance issues, misleading advertising history, conflict with Company interests, brand-safety concerns, suspected fraud, or violation of applicable law.

---

## SECTION 3 — CONSENT TO BE CONTACTED

You expressly consent to be contacted at the email address, phone number, business address, messaging account, or other contact method You provide in Your application regarding Your application, Affiliate Program status, account setup, compliance requirements, commissions, payment processing, marketing updates, training materials, product information, and program administration.

You consent to receive communications from ${ENTITY_SHORT} and third-party service providers acting on behalf of ${ENTITY_SHORT}, including through email, phone calls, text messages, automated dialing systems, artificial or pre-recorded messages, affiliate-platform notifications, and other electronic communications.

This consent is a material condition of this Agreement and may be revoked only by written notice to ${ENTITY_SHORT} unless prohibited by applicable law. You understand that revocation of consent may limit or prevent Your participation in the Affiliate Program.

---

## SECTION 4 — COMPENSATION

If Your application to become an Affiliate is approved, ${ENTITY_SHORT} may issue You a unique Affiliate ID, affiliate link, tracking URL, coupon code, referral form, or other tracking method. You may use approved tracking assets to promote eligible ${ENTITY_SHORT} offers.

You may receive a commission for each qualifying sale, subscription, account, implementation package, consulting package, software plan, or other approved transaction that is properly tracked to Your Affiliate ID and accepted by ${ENTITY_SHORT} (“Sale”).

A customer account, subscription, or transaction that qualifies for commission under this Agreement is referred to as a “Sold Account.” A Sold Account must be a legitimate, paid transaction between ${ENTITY_SHORT} and a bona fide customer who is not You, Your business, Your employee, Your contractor, Your immediate family member, Your controlled entity, or another party acting primarily to generate commissions for You.

### 4.1 Tracking and Attribution

If a prospect has multiple affiliate cookies, tracking records, referral submissions, or attribution events, the most recently acquired valid tracking record will generally determine which Affiliate is credited with the Sale, unless ${ENTITY_SHORT} determines that another attribution rule applies.

Once a Sale has been associated with an Affiliate ID, that Sale cannot be attributed to another Affiliate ID for at least six (6) months from the date of the Sale unless ${ENTITY_SHORT} determines, in its sole discretion, that the original attribution was fraudulent, incorrect, manipulated, duplicated, or otherwise invalid.

${ENTITY_SHORT} has sole and exclusive authority to deny, reverse, or revoke commissions based on affiliate-hopping, self-referrals, duplicate affiliate accounts, cookie stuffing, forced clicks, misleading redirects, unauthorized coupon use, paid-search abuse, lead poaching, customer misrepresentation, or any other conduct that creates or attempts to create multiple commissions for one true transaction.

### 4.2 Commission Rates

Your current commission rate is **${rate} of net revenue** on qualifying Sales, as set by ${ENTITY_SHORT} and displayed in Your Partner Dashboard. The rate shown in Your dashboard at any given time is the authoritative, current rate. Commission rates, eligible offers, payout terms, recurring-payment eligibility, one-time-payment eligibility, bonus eligibility, clawback periods, and promotional compensation may also be stated in a written commission schedule, signed addendum, offer page, partner program notice, or other written communication issued by ${ENTITY_SHORT}.

Commission structures may vary by product, service, customer plan, campaign, sales channel, promotional period, or Affiliate tier. ${ENTITY_SHORT} may modify commission rates or eligible offers at any time, with or without prior notice, unless otherwise provided in a written agreement signed by an authorized representative of ${ENTITY_SHORT}. Any change to Your rate will be reflected in Your Partner Dashboard.

Unless otherwise stated in writing, commissions are calculated only on net revenue actually received by ${ENTITY_SHORT}, excluding sales tax, VAT, refunds, chargebacks, credits, discounts, rebates, payment-processing fees, shipping fees, implementation pass-through costs, third-party software costs, financing fees, debt, collections, or other excluded amounts.

### 4.3 Payment Timing and Holdback

Commissions are subject to a thirty (30) day holdback period to cover potential refunds, cancellations, and chargebacks. Provided that the Sold Account remains active, paid, and in good standing through that thirty (30) day period, the commission becomes eligible for payout. Commissions on recurring subscription renewals are not subject to the holdback period and become eligible when the renewal payment is received and retained by ${ENTITY_SHORT}.

Except as otherwise provided in writing, eligible commission payments are processed on the 1st and 15th of each month, after ${ENTITY_SHORT} receives cleared payment for the qualifying Sold Account and after the applicable holdback, refund, chargeback, and approval period has passed.

If the 1st or 15th falls on a weekend, banking holiday, or non-business day, commission payments may be processed on the next business day, at ${ENTITY_SHORT}’ discretion.

### 4.4 Payment Method and Minimum Threshold

All commissions are paid in U.S. Dollars (USD) unless another currency is supported by the payment provider and approved by ${ENTITY_SHORT}.

Some payment methods may incur processing, conversion, banking, platform, or transfer fees. These fees may be deducted from Your commissions.

Your combined eligible commissions must equal or exceed the minimum payout threshold (currently **${minPayout} USD**, as shown in Your Partner Dashboard) before a payout is released. Commissions below the threshold are not forfeited — they carry forward and accumulate until the threshold is met, at which point they are paid on the next scheduled payout date.

### 4.5 Payment Provider and Tax Forms (Stripe)

${ENTITY_SHORT} uses **Stripe** (Stripe Connect) as its payment provider for affiliate payouts. Before You can receive commission payments, You must complete Stripe Connect onboarding, which is hosted and operated by Stripe and includes identity verification, bank or payout-account details, and any applicable tax forms (such as IRS Form W-9 for U.S. persons or Form W-8BEN for non-U.S. persons).

Stripe — not ${ENTITY_SHORT} — collects, verifies, and securely stores Your bank details and tax identification information, processes Your payouts, and handles applicable tax reporting, including the issuance of any required IRS Form 1099. ${ENTITY_SHORT} does not store Your full bank account number or full tax identification number.

By participating in the Affiliate Program, You authorize ${ENTITY_SHORT} and Stripe to contact You regarding payout setup, tax documentation, compliance verification, identity verification, and commission processing. Payouts cannot be released until Stripe reports that Your account is verified and payouts are enabled.

If You are not a resident of the United States, Stripe or ${ENTITY_SHORT} may withhold taxes, VAT, or other amounts where required by applicable law. You are solely responsible for complying with all tax laws in Your jurisdiction, including payment of required taxes and filing of all required returns, forms, disclosures, and other documents.

### 4.6 Prohibited Self-Referral and Duplicate Accounts

Affiliates will not be paid commissions for payments made on their own user accounts, business accounts, agency accounts, client test accounts, controlled accounts, related-party accounts, or accounts funded directly or indirectly by the Affiliate.

Affiliates may not open a ${ENTITY_SHORT}, MyOrbisVoice, MyOrbisLocal, or MyOrbisWeb account under another person’s name, another entity’s name, a fictitious name, or any name used primarily to obtain commissions or other compensation.

Affiliates may not pay for another person’s or entity’s account in order to generate commissions. Affiliates may not offer cash rebates, monetary incentives, gift cards, refunds, undisclosed discounts, or other compensation to obtain Sales unless expressly approved in writing by ${ENTITY_SHORT}.

You may not maintain more than one (1) ${ENTITY_SHORT} Affiliate account, including through Your businesses, subsidiaries, controlled entities, related companies, aliases, contractors, or other affiliated parties. If ${ENTITY_SHORT} determines that You maintain more than one Affiliate account, ${ENTITY_SHORT} may terminate all related accounts and You will immediately forfeit all commissions pending payout.

### 4.7 Refunds, Chargebacks, Cancellations, and Reversals

Commissions are paid only for transactions that actually occur between ${ENTITY_SHORT} and a bona fide customer and for which payment is actually received and retained by ${ENTITY_SHORT}.

If payment for a Sold Account later results in a refund, cancellation, credit, chargeback, returned payment, payment dispute, fraud claim, nonpayment, or collection issue, and if a commission was paid to You for that Sold Account, then the commission may be deducted from Your future commissions or otherwise recovered by ${ENTITY_SHORT}.

If ${ENTITY_SHORT} determines, in its sole and exclusive discretion, that any Sale was procured fraudulently, deceptively, unlawfully, or in violation of this Agreement, no commission will be earned or paid for that Sale. For prior Sales, ${ENTITY_SHORT} may reverse commission amounts, deduct them from future commissions, suspend Your account, terminate this Agreement immediately, and pursue any other remedy available at law or equity.

---

## SECTION 5 — TERM AND TERMINATION

The term of this Agreement begins on the earlier of: (i) the date You check the acknowledgement box and submit this Agreement; (ii) the date Your participation in the Affiliate Program is approved; (iii) the date You receive or use an affiliate link, code, or tracking asset; or (iv) the date You otherwise participate in the Affiliate Program.

Your participation in the ${ENTITY_SHORT} Affiliate Program continues month-to-month until terminated.

Either Party may terminate this Agreement at any time, with or without cause, by giving the other Party thirty (30) days’ written notice of termination.

${ENTITY_SHORT} may immediately suspend or terminate this Agreement, withhold commissions, revoke access to affiliate tools, deactivate affiliate links, or suspend any account owned or controlled by You if ${ENTITY_SHORT} determines, suspects, or receives evidence that You have:

* violated this Agreement;
* violated ${ENTITY_SHORT}’ Terms of Service, Privacy Policy, Acceptable Use Policy, or product-specific terms;
* violated any applicable law, regulation, platform policy, advertising rule, data-protection requirement, or consumer-protection standard;
* made false, misleading, unsubstantiated, deceptive, or unauthorized claims;
* failed to provide required disclosures;
* misused trademarks, brand assets, logos, screenshots, customer examples, product claims, or marketing materials;
* generated excessive disputes, refunds, complaints, spam reports, chargebacks, or compliance concerns;
* engaged in fraud, misrepresentation, self-referral, duplicate-account activity, cookie stuffing, click fraud, paid-search abuse, unauthorized scraping, impersonation, or lead theft;
* harmed or attempted to harm the reputation, operations, platform, products, customers, vendors, partners, or goodwill of ${ENTITY_SHORT} or any related brand.

For the avoidance of doubt, any violation of the required disclosure obligations in Appendix A, Section 2 will be deemed a material breach of this Agreement.

If this Agreement is canceled, suspended, or terminated due to Your breach, You immediately forfeit all commissions and any other payments owed or potentially owed to You, without further liability by ${ENTITY_SHORT}.

This Agreement may terminate automatically if You earn zero (0) commissions over a twelve (12) month period.

If this Agreement is terminated or canceled, all provisions that by their nature should survive will survive, including but not limited to limitations of liability, disclaimers of warranties, indemnity obligations, payment reversals, intellectual-property restrictions, confidentiality obligations, arbitration provisions, class-action waiver provisions, governing-law provisions, and exceptions to arbitration. All representations and warranties made by You will also survive termination or cancellation of this Agreement.

---

## SECTION 6 — ADDITIONAL REPRESENTATIONS AND WARRANTIES

In addition to Your other representations and warranties in this Agreement, You represent and warrant that:

* You have the legal authority to enter into this Agreement.
* Your participation in the Affiliate Program will not violate any agreement, law, regulation, platform rule, professional rule, employment obligation, agency agreement, non-compete, non-solicitation agreement, or other obligation that applies to You.
* Your marketing, advertising, content, emails, websites, funnels, social posts, videos, webinars, landing pages, SMS campaigns, sales calls, and promotional materials will comply with all applicable laws and platform rules.
* You will not make claims about ${ENTITY_SHORT}, MyOrbisVoice, MyOrbisLocal, MyOrbisWeb, or any related service that are false, misleading, deceptive, unsubstantiated, unauthorized, or inconsistent with Company-approved materials.
* You will not represent Yourself as an employee, officer, partner, legal representative, owner, joint venturer, franchisee, authorized reseller, or agent of ${ENTITY_SHORT} unless expressly authorized in a written agreement signed by ${ENTITY_SHORT}.
* You will not bind ${ENTITY_SHORT} to any contract, commitment, guarantee, representation, warranty, refund promise, service obligation, price concession, or customer commitment.
* You will not access, collect, store, sell, transfer, or process prospect or customer data in violation of applicable law or Company policy.
* You will maintain accurate records of Your advertising, promotional claims, disclosures, customer communications, and lead sources upon request by ${ENTITY_SHORT}.

You further represent and warrant that there are no prior or pending government investigations, inquiries, prosecutions, enforcement actions, administrative proceedings, or private lawsuits against You by the Federal Trade Commission (“FTC”), any state attorney general, any federal or state governmental agency, any privacy regulator, any advertising regulator, any industry regulatory authority, or any private party relating to alleged fraud, deceptive advertising, consumer-protection violations, telemarketing violations, privacy violations, data-security violations, intentional torts, intellectual-property violations, or unfair business practices.

If You become the subject of such an investigation, inquiry, proceeding, prosecution, lawsuit, complaint, cease-and-desist notice, platform enforcement action, or legal demand after this Agreement is executed, You must notify ${ENTITY_SHORT} within twenty-four (24) hours of Your receipt or knowledge of the same and provide all related information or documentation requested by ${ENTITY_SHORT}.

${ENTITY_SHORT} may immediately terminate Your participation in the Affiliate Program and this Agreement based on any investigation, proceeding, lawsuit, enforcement action, complaint, or legal demand identified under this section.

---

## SECTION 7 — ENTIRE AGREEMENT

This Agreement, Appendix A, ${ENTITY_SHORT}’ Terms of Service, Privacy Policy, Acceptable Use Policy, affiliate dashboard terms, product-specific terms, and any written commission schedule issued by ${ENTITY_SHORT} represent the entire agreement between the Parties concerning Your Affiliate application and, if approved, Your rights and responsibilities as an Affiliate.

This Agreement supersedes all prior or contemporaneous written or oral agreements, representations, promises, advertisements, statements, or understandings concerning the Affiliate Program.

If there is a direct conflict between the Terms of Service and this Agreement, this Agreement governs only as to Your Affiliate Program rights and obligations. Product-specific customer terms continue to govern customer use of ${ENTITY_SHORT} products and services.

---

# Appendix A — Additional Terms and Advertising Rules

These Advertising Rules apply to all activities of Affiliate.

## 1. General Compliance

Affiliate shall publish, distribute, send, display, or otherwise use advertisements, promotional materials, landing pages, posts, emails, videos, scripts, webinars, messages, calls, and other marketing content in strict compliance with all applicable laws, rules, and regulations.

These obligations include, without limitation, laws and regulations governing deceptive or misleading advertising, unfair business practices, email marketing, text-message marketing, telemarketing, consumer protection, endorsements, testimonials, online disclosures, data privacy, data security, artificial intelligence disclosures where applicable, lead generation, and platform-specific advertising rules.

Applicable laws may include, without limitation: the Federal Trade Commission Act; the FTC Endorsement Guides, 16 C.F.R. Part 255; the CAN-SPAM Act, 15 U.S.C. § 7701 et seq.; the Telephone Consumer Protection Act and related FCC rules; state consumer-protection and unfair-trade-practice statutes; state privacy laws; the California Consumer Privacy Act and California Privacy Rights Act, where applicable; the European Union General Data Protection Regulation, where applicable; the U.K. Data Protection Act and U.K. GDPR, where applicable; the Brazilian General Data Protection Law, where applicable; and all applicable social-media, search-engine, ad-network, payment-platform, and marketplace policies.

Affiliate is solely responsible for ensuring Affiliate’s compliance with all laws, rules, policies, and regulations. Affiliates are strictly prohibited from making claims concerning products or services offered by ${ENTITY_SHORT} that are inconsistent with, unsupported by, or beyond the scope of marketing materials produced or approved by ${ENTITY_SHORT}.

Affiliate is prohibited from publishing or distributing advertisements through unlawful telemarketing, robocalling, fax marketing, text messaging, scraped contact lists, purchased lead lists, deceptive lead forms, unauthorized cold outreach, or any other channel that violates applicable law or platform policy.

Affiliate shall not offer monetary incentives, rewards points, cash, refunds, rebates, gift cards, prizes, or undisclosed discounts to prospects in return for responding to an advertisement, booking a call, purchasing a service, creating an account, or subscribing to a ${ENTITY_SHORT} product unless expressly approved in writing by ${ENTITY_SHORT}.

${ENTITY_SHORT} retains sole and exclusive discretion to determine whether Affiliate’s advertising and conduct comply with this Agreement, applicable laws, Company policies, and brand standards. ${ENTITY_SHORT} is not required to advise Affiliate on legal, regulatory, or compliance matters.

## 2. Disclosure

On any website, landing page, video, post, email, webinar, funnel, review page, comparison page, advertisement, or other promotional material where Affiliate advertises, reviews, recommends, endorses, or refers to any ${ENTITY_SHORT} product or service, Affiliate must plainly and conspicuously disclose the affiliate relationship.

The disclosure must be easy to notice, easy to understand, placed near the affiliate link or endorsement, and not hidden in a footer, terms page, hyperlink, small font, low-contrast text, pop-up, collapsed section, or location that requires a user to search for it.

Affiliate may use disclosure language substantially similar to the following:

> Disclosure: I am an independent ${ENTITY_SHORT} Affiliate, not an employee, officer, owner, partner, or agent of ${ENTITY_SHORT}. I may receive referral payments from ${ENTITY_SHORT} if you purchase through my link. The opinions expressed here are my own and are not official statements of ${ENTITY_SHORT}, MyOrbisVoice, MyOrbisLocal, MyOrbisWeb, or any related company.

For short-form content where space is limited, Affiliate must still make the relationship clear using plain language such as:

> Affiliate disclosure: I may earn a commission if you purchase through my link.

Hashtags such as #ad, #sponsored, or #affiliate may be used where appropriate, but hashtags alone may not satisfy the disclosure requirement if they are unclear, hidden, or placed after a “more” button or collapsed text.

## 3. Non-Disparagement and Fair Competition

Affiliate is not permitted to publish false, misleading, deceptive, defamatory, or disparaging statements about ${ENTITY_SHORT}, MyOrbisVoice, MyOrbisLocal, MyOrbisWeb, their customers, partners, vendors, affiliates, competitors, officers, employees, contractors, or related persons or entities.

Affiliate may not engage in unlawful, deceptive, manipulative, or bad-faith search-engine optimization, search-engine marketing, review generation, reputation manipulation, competitor targeting, ad bidding, comparison advertising, or content marketing.

Affiliate may not use paid search, display ads, retargeting, sponsored content, or any other paid media based on any ${ENTITY_SHORT} trademark, product name, brand name, domain name, misspelling, confusingly similar mark, competitor trademark, or competitor brand name unless expressly authorized in writing by ${ENTITY_SHORT}.

Affiliate shall not direct-link from paid advertising to any ${ENTITY_SHORT} sales page, checkout page, pricing page, booking page, or funnel unless expressly approved in writing by ${ENTITY_SHORT}.

Affiliate may not create advertisements, landing pages, websites, domains, pages, groups, social profiles, browser extensions, or software that imply ownership of, control over, or official status with ${ENTITY_SHORT} or any related brand.

## 4. Social Media

If Affiliate advertises, promotes, reviews, recommends, or endorses ${ENTITY_SHORT}, MyOrbisVoice, MyOrbisLocal, MyOrbisWeb, or any related product or service on social media, then each post, story, reel, video, live stream, short, podcast clip, thread, article, group post, or social advertisement must comply with this Agreement, applicable law, FTC disclosure rules, and the rules of each platform.

Each social-media post must clearly disclose the affiliate relationship before or near the endorsement or affiliate link. The disclosure must appear before any “more” button, collapsed caption, link preview, or location where a user may miss it. Where the platform offers a branded-content, paid-partnership, sponsorship, or creator-disclosure tool, Affiliate must use that tool when required by the platform or applicable law.

Video content, including YouTube videos, shorts, reels, webinars, livestreams, and course content, must include a clear and conspicuous disclosure in the video itself and in the description or caption when applicable.

Affiliate must not use fake engagement, fake followers, fake testimonials, bot traffic, engagement pods, undisclosed paid endorsements, manipulated reviews, or deceptive creator collaborations.

## 5. Income, Performance, Ranking, ROI, and Business Opportunity Claims

Affiliate is expressly prohibited from making any express or implied claim that use of ${ENTITY_SHORT}, MyOrbisVoice, MyOrbisLocal, MyOrbisWeb, or any related service will guarantee income, revenue, profit, savings, customer acquisition, phone-call volume, search visibility, Google Map Pack placement, AI search visibility, appointment volume, lead volume, conversion rate, return on investment, ranking improvement, business growth, or any other specific business outcome.

Affiliate may not claim that ${ENTITY_SHORT} provides a business opportunity, franchise opportunity, guaranteed marketing system, guaranteed AI platform, guaranteed sales system, “business-in-a-box,” assisted marketing plan, passive-income system, or guaranteed revenue program.

If Affiliate makes any statement about income, savings, performance, marketing outcomes, ranking outcomes, conversion outcomes, AI visibility, local SEO results, lead generation, call-handling results, appointment-setting results, or business outcomes, Affiliate must ensure that the statement is truthful, accurate, not misleading, and supported by competent and reliable evidence.

If Affiliate makes a claim based on Affiliate’s own results, client results, case studies, testimonials, or examples, the claim must be accompanied by a clear and conspicuous disclaimer substantially similar to the following:

> These were specific results from a particular business, market, offer, budget, implementation, and time period. Your results will vary based on many factors, including your industry, market, offer, pricing, website, competition, advertising budget, customer service, data quality, implementation, and follow-up. ${ENTITY_SHORT} does not guarantee income, rankings, leads, calls, appointments, sales, or ROI.

Affiliate must not use fabricated screenshots, altered analytics, misleading ranking reports, fake call logs, fake dashboards, undisclosed simulations, artificial testimonials, or unverified customer claims.

## 6. ${ENTITY_SHORT} Trademarks and Brand Assets

No logo, tagline, trademark, trade name, service mark, domain name, design element, product name, brand name, trade dress, screenshot, interface image, demo asset, brand color system, or other intellectual property owned or controlled by ${ENTITY_SHORT} may be used, copied, reproduced, modified, distributed, registered, or displayed by Affiliate except as expressly permitted by this Agreement or written brand guidelines issued by ${ENTITY_SHORT}.

The protected brand assets include, without limitation, the names ${ENTITY_SHORT}, MyOrbisVoice, MyOrbisLocal, MyOrbisWeb, and any related logos, icons, slogans, product names, visual systems, website designs, software interfaces, videos, documentation, and marketing assets.

Affiliate may not register, purchase, use, or control any domain name, subdomain, social handle, group name, page name, app name, account name, ad account, trademark, service mark, business name, assumed name, or keyword that contains or is confusingly similar to ${ENTITY_SHORT}, MyOrbisVoice, MyOrbisLocal, MyOrbisWeb, or any related brand.

Subject to the restrictions in this Agreement, approved Affiliates are granted a limited, revocable, non-exclusive, non-transferable, non-sublicensable, and non-assignable license to use approved ${ENTITY_SHORT} brand assets solely for the purpose of promoting eligible ${ENTITY_SHORT} offers as an approved Affiliate.

${ENTITY_SHORT} retains exclusive ownership of all ${ENTITY_SHORT} trademarks, brand assets, software, content, documentation, designs, code, prompts, workflows, data, trade secrets, and intellectual property. Affiliate receives no ownership interest in any Company intellectual property.

## 7. Complaint Notification

Affiliate must notify ${ENTITY_SHORT} of any complaint, legal notice, demand letter, refund demand, advertising complaint, platform complaint, privacy complaint, consumer complaint, regulatory inquiry, intellectual-property claim, or brand-safety concern received by Affiliate regarding any advertisement, promotion, content, claim, lead source, customer interaction, or Affiliate activity related to ${ENTITY_SHORT} within twenty-four (24) hours of receiving or becoming aware of such complaint.

Notice must be sent to compliance@myorbisresults.com or any other compliance address designated by ${ENTITY_SHORT}. Affiliate must preserve all related records, including advertisements, screenshots, emails, messages, posts, call recordings, lead forms, landing pages, payment records, customer communications, and traffic-source records.

## 8. Independent Contractor

Affiliate is an independent contractor of ${ENTITY_SHORT}. Nothing in this Agreement creates a relationship of employer and employee, master and servant, principal and agent, franchisor and franchisee, partnership, joint venture, reseller, representative, legal agent, or fiduciary between ${ENTITY_SHORT} and You.

You have no right to act on behalf of, bind, obligate, represent, or speak for ${ENTITY_SHORT} in any way unless expressly authorized in a written agreement signed by ${ENTITY_SHORT}.

The only compensation available to You is the commission expressly described in this Agreement and any applicable written commission schedule. You are solely and exclusively responsible and liable for all of Your acts, omissions, expenses, taxes, business operations, advertising costs, tools, content, personnel, contractors, agents, platforms, compliance obligations, and communications.

## 9. No Warranty; No Leads; No Guaranteed Results

${ENTITY_SHORT} does not promise, guarantee, or warrant Your business success, income, sales, revenue, lead volume, search ranking, map ranking, AI visibility, appointment volume, call volume, customer acquisition, savings, commissions, or return on investment.

You understand and acknowledge that ${ENTITY_SHORT} is not required to provide sales leads, referrals, prospects, advertising budgets, marketing materials, training, traffic, accounts, customers, or business opportunities to You.

You are responsible for procuring and paying for any and all materials, resources, software, advertising, contractors, employees, legal advice, tax advice, compliance support, and business expenses necessary to operate as an Affiliate.

## 10. Limitation of Liability

EXCEPT WHERE OTHERWISE INAPPLICABLE OR PROHIBITED BY LAW, IN NO EVENT SHALL ${ENTITY_SHORT.toUpperCase()} OR ANY OF ITS OFFICERS, DIRECTORS, MEMBERS, MANAGERS, OWNERS, EMPLOYEES, INDEPENDENT CONTRACTORS, AFFILIATES, TELECOMMUNICATIONS PROVIDERS, PAYMENT PROVIDERS, SOFTWARE PROVIDERS, VENDORS, LICENSORS, OR AGENTS BE LIABLE FOR ANY INDIRECT, SPECIAL, INCIDENTAL, EXEMPLARY, CONSEQUENTIAL, PUNITIVE, OR OTHER DAMAGES, FEES, COSTS, LOSSES, OR CLAIMS ARISING FROM OR RELATED TO THIS AGREEMENT, THE AFFILIATE PROGRAM, ANY PRODUCT OR SERVICE, YOUR PARTICIPATION IN THE AFFILIATE PROGRAM, YOUR ADVERTISING, OR YOUR CONTENT, REGARDLESS OF WHETHER ${ENTITY_SHORT.toUpperCase()} HAS HAD NOTICE OF THE POSSIBILITY OF SUCH DAMAGES.

THIS LIMITATION APPLIES REGARDLESS OF THE MANNER IN WHICH DAMAGES ARE ALLEGEDLY CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER FOR BREACH OF CONTRACT, TORT, NEGLIGENCE, STRICT LIABILITY, WARRANTY, STATUTE, EQUITY, OR OTHERWISE.

IN NO EVENT SHALL ${ENTITY_SHORT.toUpperCase()}’ TOTAL LIABILITY TO YOU OR YOUR BUSINESS EXCEED THE GREATER OF: (I) THREE (3) TIMES THE COMMISSIONS PAID BY ${ENTITY_SHORT.toUpperCase()} TO YOU DURING THE MONTH PRECEDING THE DATE ON WHICH THE FACTS GIVING RISE TO THE CLAIM OCCURRED; OR (II) TWO THOUSAND DOLLARS ($2,000.00 USD).

## 11. Dispute Resolution, Class Action Waiver, and Governing Law

Any controversy, dispute, or claim arising out of or related to this Agreement, the Affiliate Program, Your relationship with ${ENTITY_SHORT}, Your advertising activity, commission payments, tracking, termination, or any related product or service that cannot be resolved through good-faith negotiation within one hundred twenty (120) days shall be resolved by binding, confidential arbitration administered by the American Arbitration Association (“AAA”) under its applicable commercial arbitration rules. Judgment on the award rendered by the arbitrator may be entered in any court having jurisdiction.

You and ${ENTITY_SHORT} agree that disputes will be resolved only on an individual basis and not as a class action, collective action, private attorney general action, consolidated action, representative action, or mass arbitration, unless such waiver is prohibited by applicable law.

The laws of the State of ${GOVERNING_STATE} shall govern this Agreement, without regard to conflict-of-law principles, unless applicable law requires otherwise. The exclusive venue for any permitted court proceeding related to this Agreement shall be the state or federal courts located in ${VENUE}, unless applicable law requires otherwise.

This section does not prevent ${ENTITY_SHORT} from seeking injunctive relief, equitable relief, intellectual-property enforcement, confidentiality enforcement, or other emergency relief in any court of competent jurisdiction.

## 12. Indemnity

You agree to protect, defend, indemnify, and hold harmless ${ENTITY_SHORT}, its officers, directors, members, managers, employees, contractors, owners, vendors, licensors, payment providers, telecommunications providers, agents, successors, and assigns from and against all claims, demands, damages, losses, liabilities, causes of action, judgments, settlements, penalties, fines, fees, costs, and expenses of every kind and character, including reasonable attorneys’ fees, arising out of or related to: Your application for or participation in the Affiliate Program; Your advertising, marketing, promotions, content, or lead-generation activity; Your breach or alleged breach of this Agreement; Your violation or alleged violation of applicable law, regulation, rule, platform policy, or third-party right; Your false, misleading, deceptive, unauthorized, or unsubstantiated claims; Your misuse of trademarks, intellectual property, brand assets, confidential information, customer data, or affiliate tracking systems; Your tax, payment, employment, contractor, agency, data-protection, or business obligations; and any third-party claim related to Your acts, omissions, negligence, misconduct, fraud, or violation of this Agreement.

This provision expressly survives termination or cancellation of this Agreement.

## 13. Severability

If any provision of this Agreement is held to be invalid, illegal, unenforceable, inconsistent with, or contrary to any applicable law, rule, or regulation, that provision shall be deemed modified to the minimum extent necessary to make it valid and enforceable. The remaining provisions of this Agreement shall continue in full force and effect.

## 14. Modification and Amendments

${ENTITY_SHORT} may modify this Agreement, the Terms of Service, the Affiliate Program, commission schedules, payment methods, eligible offers, tracking rules, brand guidelines, disclosure requirements, and advertising rules at any time, with or without prior notice, unless otherwise required by applicable law.

Amendments or modifications will be binding when they are sent to You by email, posted in the affiliate dashboard, published on a Company website, included in updated program terms, or otherwise made available to Affiliates. Your continued participation in the Affiliate Program after notice of updated terms constitutes Your acceptance of the modified Agreement.

## 15. Confidentiality

Affiliate may receive confidential, proprietary, non-public, or sensitive information from ${ENTITY_SHORT}, including but not limited to commission rates, sales data, product roadmaps, pricing structures, customer information, prospect information, internal documents, scripts, prompts, workflows, software information, platform architecture, business processes, vendor information, API information, marketing plans, beta features, training materials, and unpublished product details (“Confidential Information”).

Affiliate shall not disclose, publish, sell, share, copy, reverse engineer, misuse, or exploit Confidential Information except as necessary to participate in the Affiliate Program and only as authorized by ${ENTITY_SHORT}. This confidentiality obligation survives termination or cancellation of this Agreement.

## 16. Data Protection and Lead Handling

Affiliate is solely responsible for obtaining all required consents, permissions, notices, and legal bases before collecting, processing, storing, transferring, uploading, selling, sharing, or using prospect, lead, customer, or personal information.

Affiliate may not submit scraped, purchased, harvested, unlawfully obtained, misleadingly obtained, or non-consented lead data to ${ENTITY_SHORT}. Affiliate must promptly delete or return Company data upon request and must cooperate with ${ENTITY_SHORT} regarding privacy requests, deletion requests, access requests, opt-out requests, legal demands, and compliance reviews.

## 17. Audit and Compliance Review

${ENTITY_SHORT} may review Affiliate’s websites, content, ads, funnels, landing pages, social-media accounts, email campaigns, scripts, call recordings, lead sources, traffic sources, disclosures, and promotional materials to determine compliance with this Agreement. Affiliate agrees to provide reasonable cooperation and documentation upon request.

${ENTITY_SHORT} may require Affiliate to remove, revise, pause, or discontinue any advertisement, claim, website, funnel, post, email, script, video, keyword, landing page, or promotional method that ${ENTITY_SHORT} determines is noncompliant, risky, misleading, off-brand, or otherwise unacceptable. Failure to comply may result in immediate suspension or termination and forfeiture of unpaid commissions.

## 18. Notices

All notices required under this Agreement must be sent in writing to the applicable Party. Notices to ${ENTITY_SHORT} must be sent to:

> ${ENTITY_NAME}
> ${ENTITY_ADDRESS}
> Affiliate Support: affiliates@myorbisresults.com
> Compliance: compliance@myorbisresults.com
> Legal: legal@myorbisresults.com

Notices to Affiliate may be sent to the email address, mailing address, affiliate-dashboard account, or other contact method provided by Affiliate.

## 19. Electronic Signature and Acceptance

You agree that checking the acknowledgement box, typing Your legal name, and submitting this Agreement, using an affiliate link, logging into the affiliate dashboard, promoting a ${ENTITY_SHORT} offer, accepting commission payments, or otherwise participating in the Affiliate Program constitutes an electronic signature and acceptance of this Agreement. Electronic signatures and records shall have the same legal effect as original signatures and paper records.

## 20. Copyright Notice

Copyright © ${YEAR} ${ENTITY_SHORT}. All Rights Reserved.

${ENTITY_SHORT}, MyOrbisVoice, MyOrbisLocal, MyOrbisWeb, and all related names, logos, product names, service names, designs, documentation, software, content, workflows, and brand assets are the property of ${ENTITY_SHORT} or their respective owners.`
}

function buildEs(rate: string, minPayout: string): string {
  return `# Acuerdo de Afiliados de ${ENTITY_SHORT}

Este Acuerdo de Afiliados (el “Acuerdo”) rige tu solicitud y cualquier participación posterior en el Programa de Afiliados de ${ENTITY_SHORT}. Al marcar la casilla de reconocimiento, escribir tu nombre legal y enviar este Acuerdo, al enviar una solicitud de afiliado, recibir un enlace de afiliado o participar de cualquier otra forma en el Programa de Afiliados, declaras que has leído y comprendido este Acuerdo y aceptas quedar obligado por sus términos.

${ENTITY_SHORT} puede ofrecerte la oportunidad de convertirte en un Afiliado independiente de ${ENTITY_SHORT}, mediante el cual puedes ganar comisiones por referidos por ventas aprobadas de productos, servicios, suscripciones, cuentas, software, servicios de implementación u ofertas relacionadas de ${ENTITY_SHORT}, incluyendo, entre otros, MyOrbisVoice, MyOrbisLocal, MyOrbisWeb y cualquier otro producto o servicio actual o futuro ofrecido bajo la familia de marcas de ${ENTITY_SHORT}.

${ENTITY_SHORT} se reserva el derecho único y exclusivo de aprobar o rechazar a cualquier Afiliado, determinar la estructura de comisiones de cada oferta, modificar las tasas de comisión, denegar o revocar comisiones y administrar el Programa de Afiliados conforme a este Acuerdo. La compensación del Afiliado se describe con más detalle a continuación. Los Términos de Servicio, la Política de Privacidad, la Política de Uso Aceptable y cualquier término específico de producto aplicable de ${ENTITY_SHORT} también te aplican en tu rol de Afiliado, salvo que este Acuerdo los modifique expresamente.

---

## SECCIÓN 1 — PARTES

Toda referencia a “${ENTITY_SHORT}”, la “Compañía”, “nosotros” o “nuestro” significa y se refiere a **${ENTITY_NAME}**, ubicada en ${ENTITY_ADDRESS}, el negocio operador asociado con MyOrbisVoice, MyOrbisLocal, MyOrbisWeb y servicios relacionados.

Toda referencia a “tú”, “tu” o “Afiliado” significa y se refiere a la persona, empresa o entidad legal que solicita, acepta o participa en el Programa de Afiliados de ${ENTITY_SHORT}.

${ENTITY_SHORT} y tú se denominan cada uno una “Parte” y, en conjunto, las “Partes”.

Aceptas notificar por escrito a ${ENTITY_SHORT} si tu nombre legal, nombre comercial, clasificación fiscal, propiedad, información de pago o titularidad de la cuenta cambian, dentro de las veinticuatro (24) horas posteriores a dicho cambio. Certificas que toda la información proporcionada a ${ENTITY_SHORT} es veraz, exacta, completa y no engañosa. El aviso de tales cambios debe enviarse a affiliates@myorbisresults.com o a cualquier otra dirección de soporte de afiliados designada por ${ENTITY_SHORT}.

---

## SECCIÓN 2 — SOLICITUD

Aceptas proporcionar toda la información solicitada por ${ENTITY_SHORT} en relación con tu solicitud de Afiliado y tu participación continua en el Programa de Afiliados. Afirmas que toda la información que proporcionas es veraz, exacta, actual y completa, sin omisión material.

${ENTITY_SHORT} conserva la discreción única y exclusiva para determinar si calificas para participar en el Programa de Afiliados. No toda persona, empresa, creador, agencia, consultor, revendedor o proveedor de servicios que solicite será aprobado.

${ENTITY_SHORT} puede rechazar, suspender o cancelar una solicitud o cuenta de Afiliado por cualquier motivo, incluyendo, entre otros, información incompleta o inexacta, problemas de cumplimiento previos, historial de publicidad engañosa, conflicto con los intereses de la Compañía, preocupaciones de seguridad de marca, sospecha de fraude o violación de la ley aplicable.

---

## SECCIÓN 3 — CONSENTIMIENTO PARA SER CONTACTADO

Consientes expresamente ser contactado en la dirección de correo electrónico, el número de teléfono, la dirección comercial, la cuenta de mensajería u otro método de contacto que proporciones en tu solicitud, en relación con tu solicitud, el estado del Programa de Afiliados, la configuración de la cuenta, los requisitos de cumplimiento, las comisiones, el procesamiento de pagos, las actualizaciones de marketing, los materiales de capacitación, la información de productos y la administración del programa.

Consientes recibir comunicaciones de ${ENTITY_SHORT} y de terceros proveedores de servicios que actúen en nombre de ${ENTITY_SHORT}, incluyendo correo electrónico, llamadas telefónicas, mensajes de texto, sistemas de marcación automática, mensajes artificiales o pregrabados, notificaciones de la plataforma de afiliados y otras comunicaciones electrónicas.

Este consentimiento es una condición material de este Acuerdo y solo puede revocarse mediante notificación por escrito a ${ENTITY_SHORT}, salvo que lo prohíba la ley aplicable. Entiendes que la revocación del consentimiento puede limitar o impedir tu participación en el Programa de Afiliados.

---

## SECCIÓN 4 — COMPENSACIÓN

Si tu solicitud para convertirte en Afiliado es aprobada, ${ENTITY_SHORT} puede emitirte un ID de Afiliado único, un enlace de afiliado, una URL de seguimiento, un código de cupón, un formulario de referido u otro método de seguimiento. Puedes usar los activos de seguimiento aprobados para promover ofertas elegibles de ${ENTITY_SHORT}.

Puedes recibir una comisión por cada venta calificada, suscripción, cuenta, paquete de implementación, paquete de consultoría, plan de software u otra transacción aprobada que se rastree correctamente a tu ID de Afiliado y sea aceptada por ${ENTITY_SHORT} (una “Venta”).

Una cuenta de cliente, suscripción o transacción que califique para comisión bajo este Acuerdo se denomina “Cuenta Vendida”. Una Cuenta Vendida debe ser una transacción legítima y pagada entre ${ENTITY_SHORT} y un cliente de buena fe que no seas tú, tu empresa, tu empleado, tu contratista, un familiar directo, una entidad bajo tu control u otra parte que actúe principalmente para generar comisiones para ti.

### 4.1 Seguimiento y Atribución

Si un prospecto tiene varias cookies de afiliado, registros de seguimiento, envíos de referido o eventos de atribución, el registro de seguimiento válido más reciente determinará generalmente qué Afiliado recibe el crédito por la Venta, salvo que ${ENTITY_SHORT} determine que aplica otra regla de atribución.

Una vez que una Venta se ha asociado a un ID de Afiliado, esa Venta no puede atribuirse a otro ID de Afiliado durante al menos seis (6) meses desde la fecha de la Venta, salvo que ${ENTITY_SHORT} determine, a su entera discreción, que la atribución original fue fraudulenta, incorrecta, manipulada, duplicada o de otro modo inválida.

${ENTITY_SHORT} tiene la autoridad única y exclusiva para denegar, revertir o revocar comisiones por cambio de afiliado, autorreferidos, cuentas de afiliado duplicadas, relleno de cookies, clics forzados, redirecciones engañosas, uso no autorizado de cupones, abuso de búsqueda pagada, robo de prospectos, tergiversación de clientes o cualquier otra conducta que cree o intente crear múltiples comisiones por una sola transacción real.

### 4.2 Tasas de Comisión

Tu tasa de comisión actual es del **${rate} de los ingresos netos** sobre las Ventas calificadas, según la establece ${ENTITY_SHORT} y se muestra en tu Panel de Partner. La tasa que aparece en tu panel en cada momento es la tasa actual y autoritativa. Las tasas de comisión, ofertas elegibles, términos de pago, elegibilidad de pagos recurrentes, elegibilidad de pagos únicos, elegibilidad de bonos, períodos de reversión y compensación promocional también pueden indicarse en un calendario de comisiones por escrito, un anexo firmado, una página de oferta, un aviso del programa de partners u otra comunicación escrita emitida por ${ENTITY_SHORT}.

Las estructuras de comisión pueden variar según el producto, servicio, plan del cliente, campaña, canal de ventas, período promocional o nivel de Afiliado. ${ENTITY_SHORT} puede modificar las tasas de comisión o las ofertas elegibles en cualquier momento, con o sin aviso previo, salvo que se disponga lo contrario en un acuerdo escrito firmado por un representante autorizado de ${ENTITY_SHORT}. Cualquier cambio en tu tasa se reflejará en tu Panel de Partner.

Salvo que se indique lo contrario por escrito, las comisiones se calculan únicamente sobre los ingresos netos efectivamente recibidos por ${ENTITY_SHORT}, excluyendo impuestos sobre ventas, IVA, reembolsos, contracargos, créditos, descuentos, reembolsos parciales, comisiones de procesamiento de pagos, costos de software de terceros, cargos de financiación, deudas, cobranzas u otros montos excluidos.

### 4.3 Plazos de Pago y Retención

Las comisiones están sujetas a un período de retención de treinta (30) días para cubrir posibles reembolsos, cancelaciones y contracargos. Siempre que la Cuenta Vendida permanezca activa, pagada y en regla durante ese período de treinta (30) días, la comisión pasa a ser elegible para pago. Las comisiones por renovaciones de suscripción recurrentes no están sujetas al período de retención y pasan a ser elegibles cuando ${ENTITY_SHORT} recibe y conserva el pago de la renovación.

Salvo que se disponga lo contrario por escrito, los pagos de comisiones elegibles se procesan el día 1 y el día 15 de cada mes, después de que ${ENTITY_SHORT} reciba el pago liquidado de la Cuenta Vendida calificada y después de que haya transcurrido el período aplicable de retención, reembolso, contracargo y aprobación.

Si el día 1 o el día 15 cae en fin de semana, feriado bancario o día no hábil, los pagos de comisiones pueden procesarse el siguiente día hábil, a discreción de ${ENTITY_SHORT}.

### 4.4 Método de Pago y Umbral Mínimo

Todas las comisiones se pagan en dólares estadounidenses (USD), salvo que el proveedor de pagos admita otra moneda y ${ENTITY_SHORT} la apruebe.

Algunos métodos de pago pueden generar comisiones de procesamiento, conversión, bancarias, de plataforma o de transferencia. Estas comisiones pueden deducirse de tus comisiones.

Tus comisiones elegibles combinadas deben ser iguales o superiores al umbral mínimo de pago (actualmente **${minPayout} USD**, según se muestra en tu Panel de Partner) antes de que se libere un pago. Las comisiones por debajo del umbral no se pierden: se trasladan y acumulan hasta que se alcanza el umbral, momento en el cual se pagan en la siguiente fecha de pago programada.

### 4.5 Proveedor de Pagos y Formularios Fiscales (Stripe)

${ENTITY_SHORT} utiliza **Stripe** (Stripe Connect) como su proveedor de pagos para los pagos a afiliados. Antes de poder recibir pagos de comisiones, debes completar el registro de Stripe Connect, que es alojado y operado por Stripe e incluye la verificación de identidad, los datos de la cuenta bancaria o de pago y los formularios fiscales aplicables (como el formulario W-9 del IRS para personas estadounidenses o el formulario W-8BEN para personas no estadounidenses).

Stripe, y no ${ENTITY_SHORT}, recopila, verifica y almacena de forma segura tus datos bancarios e información de identificación fiscal, procesa tus pagos y gestiona la declaración fiscal aplicable, incluyendo la emisión de cualquier formulario 1099 del IRS requerido. ${ENTITY_SHORT} no almacena tu número completo de cuenta bancaria ni tu número completo de identificación fiscal.

Al participar en el Programa de Afiliados, autorizas a ${ENTITY_SHORT} y a Stripe a contactarte en relación con la configuración de pagos, la documentación fiscal, la verificación de cumplimiento, la verificación de identidad y el procesamiento de comisiones. Los pagos no pueden liberarse hasta que Stripe informe que tu cuenta está verificada y los pagos están habilitados.

Si no eres residente de los Estados Unidos, Stripe o ${ENTITY_SHORT} pueden retener impuestos, IVA u otros montos cuando lo exija la ley aplicable. Eres el único responsable de cumplir con todas las leyes fiscales de tu jurisdicción, incluyendo el pago de los impuestos requeridos y la presentación de todas las declaraciones, formularios y divulgaciones requeridos.

### 4.6 Prohibición de Autorreferidos y Cuentas Duplicadas

No se pagarán comisiones a los Afiliados por pagos realizados en sus propias cuentas de usuario, cuentas comerciales, cuentas de agencia, cuentas de prueba de clientes, cuentas controladas, cuentas de partes relacionadas o cuentas financiadas directa o indirectamente por el Afiliado.

Los Afiliados no pueden abrir una cuenta de ${ENTITY_SHORT}, MyOrbisVoice, MyOrbisLocal o MyOrbisWeb bajo el nombre de otra persona, el nombre de otra entidad, un nombre ficticio o cualquier nombre usado principalmente para obtener comisiones u otra compensación.

Los Afiliados no pueden pagar la cuenta de otra persona o entidad para generar comisiones, ni ofrecer reembolsos en efectivo, incentivos monetarios, tarjetas de regalo, reembolsos, descuentos no divulgados u otra compensación para obtener Ventas, salvo que ${ENTITY_SHORT} lo apruebe expresamente por escrito.

No puedes mantener más de una (1) cuenta de Afiliado de ${ENTITY_SHORT}, incluso a través de tus empresas, subsidiarias, entidades controladas, empresas relacionadas, alias, contratistas u otras partes afiliadas. Si ${ENTITY_SHORT} determina que mantienes más de una cuenta de Afiliado, ${ENTITY_SHORT} puede cancelar todas las cuentas relacionadas y perderás de inmediato todas las comisiones pendientes de pago.

### 4.7 Reembolsos, Contracargos, Cancelaciones y Reversiones

Las comisiones se pagan solo por transacciones que efectivamente ocurren entre ${ENTITY_SHORT} y un cliente de buena fe y por las cuales ${ENTITY_SHORT} efectivamente recibe y conserva el pago.

Si el pago de una Cuenta Vendida posteriormente da lugar a un reembolso, cancelación, crédito, contracargo, pago devuelto, disputa de pago, reclamo de fraude, falta de pago o problema de cobranza, y si se te pagó una comisión por esa Cuenta Vendida, dicha comisión puede deducirse de tus comisiones futuras o ser recuperada de otro modo por ${ENTITY_SHORT}.

Si ${ENTITY_SHORT} determina, a su entera y exclusiva discreción, que una Venta se obtuvo de manera fraudulenta, engañosa, ilegal o en violación de este Acuerdo, no se devengará ni pagará comisión por esa Venta. Para Ventas anteriores, ${ENTITY_SHORT} puede revertir los montos de comisión, deducirlos de comisiones futuras, suspender tu cuenta, terminar este Acuerdo de inmediato y ejercer cualquier otro recurso disponible en derecho o en equidad.

---

## SECCIÓN 5 — VIGENCIA Y TERMINACIÓN

La vigencia de este Acuerdo comienza en la primera de las siguientes fechas: (i) la fecha en que marcas la casilla de reconocimiento y envías este Acuerdo; (ii) la fecha en que se aprueba tu participación en el Programa de Afiliados; (iii) la fecha en que recibes o usas un enlace, código o activo de seguimiento de afiliado; o (iv) la fecha en que participas de otro modo en el Programa de Afiliados.

Tu participación en el Programa de Afiliados de ${ENTITY_SHORT} continúa mes a mes hasta su terminación.

Cualquiera de las Partes puede terminar este Acuerdo en cualquier momento, con o sin causa, dando a la otra Parte un aviso de terminación por escrito con treinta (30) días de anticipación.

${ENTITY_SHORT} puede suspender o terminar de inmediato este Acuerdo, retener comisiones, revocar el acceso a las herramientas de afiliado, desactivar enlaces de afiliado o suspender cualquier cuenta de tu propiedad o bajo tu control si ${ENTITY_SHORT} determina, sospecha o recibe pruebas de que has:

* violado este Acuerdo;
* violado los Términos de Servicio, la Política de Privacidad, la Política de Uso Aceptable o los términos específicos de producto de ${ENTITY_SHORT};
* violado cualquier ley, regulación, política de plataforma, regla publicitaria, requisito de protección de datos o norma de protección al consumidor aplicable;
* hecho afirmaciones falsas, engañosas, no sustentadas o no autorizadas;
* incumplido con las divulgaciones requeridas;
* hecho mal uso de marcas, activos de marca, logotipos, capturas de pantalla, ejemplos de clientes, afirmaciones de producto o materiales de marketing;
* generado disputas, reembolsos, quejas, reportes de spam, contracargos o preocupaciones de cumplimiento excesivos;
* incurrido en fraude, tergiversación, autorreferido, actividad de cuentas duplicadas, relleno de cookies, fraude de clics, abuso de búsqueda pagada, scraping no autorizado, suplantación o robo de prospectos;
* dañado o intentado dañar la reputación, las operaciones, la plataforma, los productos, los clientes, los proveedores, los socios o el buen nombre de ${ENTITY_SHORT} o de cualquier marca relacionada.

Para evitar dudas, cualquier violación de las obligaciones de divulgación requeridas en el Apéndice A, Sección 2 se considerará un incumplimiento material de este Acuerdo.

Si este Acuerdo se cancela, suspende o termina debido a tu incumplimiento, pierdes de inmediato todas las comisiones y cualquier otro pago adeudado o potencialmente adeudado, sin responsabilidad adicional de ${ENTITY_SHORT}.

Este Acuerdo puede terminar automáticamente si ganas cero (0) comisiones durante un período de doce (12) meses.

Si este Acuerdo se termina o cancela, todas las disposiciones que por su naturaleza deban subsistir subsistirán, incluyendo, entre otras, las limitaciones de responsabilidad, las renuncias de garantías, las obligaciones de indemnización, las reversiones de pagos, las restricciones de propiedad intelectual, las obligaciones de confidencialidad, las disposiciones de arbitraje, las disposiciones de renuncia a acciones colectivas y las disposiciones de ley aplicable.

---

## SECCIÓN 6 — DECLARACIONES Y GARANTÍAS ADICIONALES

Además de tus otras declaraciones y garantías en este Acuerdo, declaras y garantizas que:

* Tienes la autoridad legal para celebrar este Acuerdo.
* Tu participación en el Programa de Afiliados no violará ningún acuerdo, ley, regulación, regla de plataforma, regla profesional, obligación laboral, acuerdo de agencia, no competencia, acuerdo de no captación u otra obligación que te aplique.
* Tu marketing, publicidad, contenido, correos, sitios web, embudos, publicaciones sociales, videos, seminarios web, páginas de aterrizaje, campañas de SMS, llamadas de ventas y materiales promocionales cumplirán con todas las leyes y reglas de plataforma aplicables.
* No harás afirmaciones sobre ${ENTITY_SHORT}, MyOrbisVoice, MyOrbisLocal, MyOrbisWeb o cualquier servicio relacionado que sean falsas, engañosas, no sustentadas, no autorizadas o inconsistentes con los materiales aprobados por la Compañía.
* No te representarás como empleado, directivo, socio, representante legal, propietario, copartícipe, franquiciado, revendedor autorizado o agente de ${ENTITY_SHORT}, salvo autorización expresa en un acuerdo escrito firmado por ${ENTITY_SHORT}.
* No obligarás a ${ENTITY_SHORT} a ningún contrato, compromiso, garantía, declaración, promesa de reembolso, obligación de servicio, concesión de precio o compromiso con clientes.
* No accederás, recopilarás, almacenarás, venderás, transferirás ni procesarás datos de prospectos o clientes en violación de la ley aplicable o la política de la Compañía.
* Mantendrás registros precisos de tu publicidad, afirmaciones promocionales, divulgaciones, comunicaciones con clientes y fuentes de prospectos, a solicitud de ${ENTITY_SHORT}.

Además, declaras y garantizas que no existen investigaciones, indagaciones, procesos, acciones de aplicación, procedimientos administrativos o demandas privadas gubernamentales previos o pendientes en tu contra por parte de la Comisión Federal de Comercio (“FTC”), cualquier fiscal general estatal, cualquier agencia gubernamental federal o estatal, cualquier regulador de privacidad o publicidad, cualquier autoridad regulatoria de la industria o cualquier parte privada relacionados con presunto fraude, publicidad engañosa, violaciones de protección al consumidor, violaciones de telemercadeo, violaciones de privacidad, violaciones de seguridad de datos, agravios intencionales, violaciones de propiedad intelectual o prácticas comerciales desleales.

Si después de la firma de este Acuerdo pasas a ser objeto de tal investigación, procedimiento, demanda, acción de aplicación, queja o requerimiento legal, debes notificar a ${ENTITY_SHORT} dentro de las veinticuatro (24) horas posteriores a tu recepción o conocimiento del mismo y proporcionar toda la información o documentación relacionada que ${ENTITY_SHORT} solicite.

---

## SECCIÓN 7 — ACUERDO COMPLETO

Este Acuerdo, el Apéndice A, los Términos de Servicio, la Política de Privacidad, la Política de Uso Aceptable, los términos del panel de afiliados, los términos específicos de producto y cualquier calendario de comisiones por escrito emitido por ${ENTITY_SHORT} representan el acuerdo completo entre las Partes con respecto a tu solicitud de Afiliado y, si es aprobada, tus derechos y responsabilidades como Afiliado.

Este Acuerdo reemplaza todos los acuerdos, declaraciones, promesas, anuncios, declaraciones o entendimientos previos o contemporáneos, escritos u orales, relativos al Programa de Afiliados.

Si existe un conflicto directo entre los Términos de Servicio y este Acuerdo, este Acuerdo prevalece únicamente en cuanto a tus derechos y obligaciones del Programa de Afiliados. Los términos específicos de producto para clientes seguirán rigiendo el uso de los productos y servicios de ${ENTITY_SHORT} por parte de los clientes.

---

# Apéndice A — Términos Adicionales y Reglas de Publicidad

Estas Reglas de Publicidad aplican a todas las actividades del Afiliado.

## 1. Cumplimiento General

El Afiliado publicará, distribuirá, enviará, mostrará o usará de otro modo anuncios, materiales promocionales, páginas de aterrizaje, publicaciones, correos, videos, guiones, seminarios web, mensajes, llamadas y otro contenido de marketing en estricto cumplimiento de todas las leyes, reglas y regulaciones aplicables.

Estas obligaciones incluyen, sin limitación, las leyes y regulaciones que rigen la publicidad engañosa, las prácticas comerciales desleales, el marketing por correo electrónico, el marketing por mensajes de texto, el telemercadeo, la protección al consumidor, los respaldos, los testimonios, las divulgaciones en línea, la privacidad de datos, la seguridad de datos, las divulgaciones de inteligencia artificial cuando correspondan, la generación de prospectos y las reglas de publicidad específicas de cada plataforma.

El Afiliado es el único responsable de garantizar su cumplimiento de todas las leyes, reglas, políticas y regulaciones. Se prohíbe estrictamente a los Afiliados hacer afirmaciones sobre los productos o servicios de ${ENTITY_SHORT} que sean inconsistentes con, no estén respaldadas por, o excedan el alcance de los materiales de marketing producidos o aprobados por ${ENTITY_SHORT}.

Se prohíbe al Afiliado publicar o distribuir anuncios a través de telemercadeo ilegal, llamadas automáticas, marketing por fax, mensajes de texto, listas de contactos extraídas mediante scraping, listas de prospectos compradas, formularios de prospectos engañosos, contacto en frío no autorizado o cualquier otro canal que viole la ley aplicable o la política de la plataforma.

El Afiliado no ofrecerá incentivos monetarios, puntos de recompensa, efectivo, reembolsos, tarjetas de regalo, premios o descuentos no divulgados a los prospectos a cambio de responder a un anuncio, agendar una llamada, comprar un servicio, crear una cuenta o suscribirse a un producto de ${ENTITY_SHORT}, salvo aprobación expresa por escrito de ${ENTITY_SHORT}.

${ENTITY_SHORT} conserva la discreción única y exclusiva para determinar si la publicidad y la conducta del Afiliado cumplen con este Acuerdo, las leyes aplicables, las políticas de la Compañía y los estándares de marca. ${ENTITY_SHORT} no está obligada a asesorar al Afiliado en asuntos legales, regulatorios o de cumplimiento.

## 2. Divulgación

En cualquier sitio web, página de aterrizaje, video, publicación, correo, seminario web, embudo, página de reseñas, página de comparación, anuncio u otro material promocional donde el Afiliado anuncie, reseñe, recomiende, respalde o se refiera a cualquier producto o servicio de ${ENTITY_SHORT}, el Afiliado debe divulgar de forma clara y visible la relación de afiliado.

La divulgación debe ser fácil de notar, fácil de entender, ubicada cerca del enlace de afiliado o del respaldo, y no oculta en un pie de página, página de términos, hipervínculo, fuente pequeña, texto de bajo contraste, ventana emergente, sección colapsada o ubicación que requiera que el usuario la busque.

El Afiliado puede usar un lenguaje de divulgación sustancialmente similar al siguiente:

> Divulgación: Soy un Afiliado independiente de ${ENTITY_SHORT}, no un empleado, directivo, propietario, socio o agente de ${ENTITY_SHORT}. Puedo recibir pagos por referidos de ${ENTITY_SHORT} si compras a través de mi enlace. Las opiniones aquí expresadas son propias y no son declaraciones oficiales de ${ENTITY_SHORT}, MyOrbisVoice, MyOrbisLocal, MyOrbisWeb o cualquier empresa relacionada.

Para contenido de formato corto donde el espacio es limitado, el Afiliado aún debe dejar clara la relación con un lenguaje sencillo como:

> Divulgación de afiliado: Puedo ganar una comisión si compras a través de mi enlace.

Los hashtags como #ad, #sponsored o #affiliate pueden usarse cuando corresponda, pero los hashtags por sí solos pueden no satisfacer el requisito de divulgación si no son claros, están ocultos o se colocan después de un botón “más” o de texto colapsado.

## 3. No Difamación y Competencia Leal

No se permite al Afiliado publicar declaraciones falsas, engañosas, difamatorias o despectivas sobre ${ENTITY_SHORT}, MyOrbisVoice, MyOrbisLocal, MyOrbisWeb, sus clientes, socios, proveedores, afiliados, competidores, directivos, empleados, contratistas o personas o entidades relacionadas.

El Afiliado no puede incurrir en optimización de motores de búsqueda, marketing de motores de búsqueda, generación de reseñas, manipulación de reputación, segmentación de competidores, pujas publicitarias, publicidad comparativa o marketing de contenidos de manera ilegal, engañosa, manipuladora o de mala fe.

El Afiliado no puede usar búsqueda pagada, anuncios de display, retargeting, contenido patrocinado u otro medio pagado basado en cualquier marca, nombre de producto, nombre de marca, nombre de dominio, error ortográfico, marca confusamente similar, marca de competidor o nombre de marca de competidor de ${ENTITY_SHORT}, salvo autorización expresa por escrito de ${ENTITY_SHORT}.

El Afiliado no debe enlazar directamente desde publicidad pagada a ninguna página de ventas, página de pago, página de precios, página de reservas o embudo de ${ENTITY_SHORT}, salvo aprobación expresa por escrito de ${ENTITY_SHORT}.

El Afiliado no puede crear anuncios, páginas de aterrizaje, sitios web, dominios, páginas, grupos, perfiles sociales, extensiones de navegador o software que impliquen propiedad, control o estatus oficial con ${ENTITY_SHORT} o cualquier marca relacionada.

## 4. Redes Sociales

Si el Afiliado anuncia, promueve, reseña, recomienda o respalda a ${ENTITY_SHORT}, MyOrbisVoice, MyOrbisLocal, MyOrbisWeb o cualquier producto o servicio relacionado en redes sociales, cada publicación, historia, reel, video, transmisión en vivo, short, clip de podcast, hilo, artículo, publicación de grupo o anuncio social debe cumplir con este Acuerdo, la ley aplicable, las reglas de divulgación de la FTC y las reglas de cada plataforma.

Cada publicación en redes sociales debe divulgar claramente la relación de afiliado antes o cerca del respaldo o del enlace de afiliado. La divulgación debe aparecer antes de cualquier botón “más”, leyenda colapsada, vista previa de enlace o ubicación donde el usuario pueda pasarla por alto. Cuando la plataforma ofrezca una herramienta de contenido de marca, asociación pagada, patrocinio o divulgación de creador, el Afiliado debe usar esa herramienta cuando lo exija la plataforma o la ley aplicable.

El contenido de video, incluyendo videos de YouTube, shorts, reels, seminarios web, transmisiones en vivo y contenido de cursos, debe incluir una divulgación clara y visible en el propio video y en la descripción o leyenda cuando corresponda.

El Afiliado no debe usar interacción falsa, seguidores falsos, testimonios falsos, tráfico de bots, grupos de interacción, respaldos pagados no divulgados, reseñas manipuladas o colaboraciones engañosas de creadores.

## 5. Afirmaciones de Ingresos, Desempeño, Posicionamiento, ROI y Oportunidad de Negocio

Se prohíbe expresamente al Afiliado hacer cualquier afirmación expresa o implícita de que el uso de ${ENTITY_SHORT}, MyOrbisVoice, MyOrbisLocal, MyOrbisWeb o cualquier servicio relacionado garantizará ingresos, ganancias, ahorros, adquisición de clientes, volumen de llamadas, visibilidad de búsqueda, posición en el Map Pack de Google, visibilidad en búsqueda con IA, volumen de citas, volumen de prospectos, tasa de conversión, retorno de inversión, mejora de posicionamiento, crecimiento del negocio o cualquier otro resultado comercial específico.

El Afiliado no puede afirmar que ${ENTITY_SHORT} proporciona una oportunidad de negocio, oportunidad de franquicia, sistema de marketing garantizado, plataforma de IA garantizada, sistema de ventas garantizado, “negocio en una caja”, plan de marketing asistido, sistema de ingresos pasivos o programa de ingresos garantizados.

Si el Afiliado hace cualquier declaración sobre ingresos, ahorros, desempeño, resultados de marketing, resultados de posicionamiento, resultados de conversión, visibilidad de IA, resultados de SEO local, generación de prospectos, resultados de manejo de llamadas, resultados de agendamiento de citas o resultados comerciales, el Afiliado debe asegurarse de que la declaración sea veraz, exacta, no engañosa y respaldada por evidencia competente y confiable.

Si el Afiliado hace una afirmación basada en sus propios resultados, resultados de clientes, casos de estudio, testimonios o ejemplos, la afirmación debe ir acompañada de un descargo de responsabilidad claro y visible sustancialmente similar al siguiente:

> Estos fueron resultados específicos de un negocio, mercado, oferta, presupuesto, implementación y período de tiempo particular. Tus resultados variarán según muchos factores, incluyendo tu industria, mercado, oferta, precios, sitio web, competencia, presupuesto publicitario, servicio al cliente, calidad de los datos, implementación y seguimiento. ${ENTITY_SHORT} no garantiza ingresos, posicionamientos, prospectos, llamadas, citas, ventas ni ROI.

El Afiliado no debe usar capturas de pantalla fabricadas, analíticas alteradas, reportes de posicionamiento engañosos, registros de llamadas falsos, paneles falsos, simulaciones no divulgadas, testimonios artificiales o afirmaciones de clientes no verificadas.

## 6. Marcas y Activos de Marca de ${ENTITY_SHORT}

Ningún logotipo, eslogan, marca registrada, nombre comercial, marca de servicio, nombre de dominio, elemento de diseño, nombre de producto, nombre de marca, imagen comercial, captura de pantalla, imagen de interfaz, activo de demostración, sistema de colores de marca u otra propiedad intelectual de propiedad o bajo control de ${ENTITY_SHORT} puede ser usado, copiado, reproducido, modificado, distribuido, registrado o mostrado por el Afiliado, salvo lo expresamente permitido por este Acuerdo o por las directrices de marca escritas emitidas por ${ENTITY_SHORT}.

Los activos de marca protegidos incluyen, sin limitación, los nombres ${ENTITY_SHORT}, MyOrbisVoice, MyOrbisLocal, MyOrbisWeb y cualquier logotipo, ícono, eslogan, nombre de producto, sistema visual, diseño de sitio web, interfaz de software, video, documentación y activo de marketing relacionado.

El Afiliado no puede registrar, comprar, usar o controlar ningún nombre de dominio, subdominio, identificador social, nombre de grupo, nombre de página, nombre de aplicación, nombre de cuenta, cuenta publicitaria, marca, nombre comercial o palabra clave que contenga o sea confusamente similar a ${ENTITY_SHORT}, MyOrbisVoice, MyOrbisLocal, MyOrbisWeb o cualquier marca relacionada.

Sujeto a las restricciones de este Acuerdo, a los Afiliados aprobados se les otorga una licencia limitada, revocable, no exclusiva, intransferible, no sublicenciable y no asignable para usar los activos de marca aprobados de ${ENTITY_SHORT} únicamente con el fin de promover ofertas elegibles de ${ENTITY_SHORT} como Afiliado aprobado.

${ENTITY_SHORT} conserva la propiedad exclusiva de todas las marcas, activos de marca, software, contenido, documentación, diseños, código, prompts, flujos de trabajo, datos, secretos comerciales y propiedad intelectual de ${ENTITY_SHORT}. El Afiliado no recibe ningún interés de propiedad sobre la propiedad intelectual de la Compañía.

## 7. Notificación de Quejas

El Afiliado debe notificar a ${ENTITY_SHORT} cualquier queja, aviso legal, carta de demanda, exigencia de reembolso, queja publicitaria, queja de plataforma, queja de privacidad, queja de consumidor, indagación regulatoria, reclamo de propiedad intelectual o preocupación de seguridad de marca que reciba en relación con cualquier anuncio, promoción, contenido, afirmación, fuente de prospectos, interacción con clientes o actividad de Afiliado relacionada con ${ENTITY_SHORT}, dentro de las veinticuatro (24) horas posteriores a recibir o tener conocimiento de dicha queja.

El aviso debe enviarse a compliance@myorbisresults.com o a cualquier otra dirección de cumplimiento designada por ${ENTITY_SHORT}. El Afiliado debe conservar todos los registros relacionados, incluyendo anuncios, capturas de pantalla, correos, mensajes, publicaciones, grabaciones de llamadas, formularios de prospectos, páginas de aterrizaje, registros de pago, comunicaciones con clientes y registros de fuentes de tráfico.

## 8. Contratista Independiente

El Afiliado es un contratista independiente de ${ENTITY_SHORT}. Nada en este Acuerdo crea una relación de empleador y empleado, principal y agente, franquiciante y franquiciado, sociedad, empresa conjunta, revendedor, representante, agente legal o fiduciario entre ${ENTITY_SHORT} y tú.

No tienes derecho a actuar en nombre de, obligar, representar o hablar por ${ENTITY_SHORT} de ninguna manera, salvo autorización expresa en un acuerdo escrito firmado por ${ENTITY_SHORT}.

La única compensación disponible para ti es la comisión expresamente descrita en este Acuerdo y cualquier calendario de comisiones por escrito aplicable. Eres única y exclusivamente responsable de todos tus actos, omisiones, gastos, impuestos, operaciones comerciales, costos de publicidad, herramientas, contenido, personal, contratistas, agentes, plataformas, obligaciones de cumplimiento y comunicaciones.

## 9. Sin Garantía; Sin Prospectos; Sin Resultados Garantizados

${ENTITY_SHORT} no promete, garantiza ni asegura tu éxito comercial, ingresos, ventas, volumen de prospectos, posicionamiento de búsqueda, posicionamiento en mapas, visibilidad de IA, volumen de citas, volumen de llamadas, adquisición de clientes, ahorros, comisiones o retorno de inversión.

Entiendes y reconoces que ${ENTITY_SHORT} no está obligada a proporcionarte prospectos de venta, referidos, presupuestos publicitarios, materiales de marketing, capacitación, tráfico, cuentas, clientes u oportunidades de negocio.

Eres responsable de adquirir y pagar todos los materiales, recursos, software, publicidad, contratistas, empleados, asesoría legal, asesoría fiscal, soporte de cumplimiento y gastos comerciales necesarios para operar como Afiliado.

## 10. Limitación de Responsabilidad

SALVO QUE SEA INAPLICABLE O ESTÉ PROHIBIDO POR LEY, EN NINGÚN CASO ${ENTITY_SHORT.toUpperCase()} NI NINGUNO DE SUS DIRECTIVOS, GERENTES, PROPIETARIOS, EMPLEADOS, CONTRATISTAS INDEPENDIENTES, AFILIADOS, PROVEEDORES DE TELECOMUNICACIONES, PROVEEDORES DE PAGOS, PROVEEDORES DE SOFTWARE, PROVEEDORES, LICENCIANTES O AGENTES SERÁN RESPONSABLES POR DAÑOS INDIRECTOS, ESPECIALES, INCIDENTALES, EJEMPLARES, CONSECUENTES O PUNITIVOS, COSTOS, PÉRDIDAS O RECLAMOS QUE SURJAN DE O SE RELACIONEN CON ESTE ACUERDO, EL PROGRAMA DE AFILIADOS, CUALQUIER PRODUCTO O SERVICIO, TU PARTICIPACIÓN EN EL PROGRAMA DE AFILIADOS, TU PUBLICIDAD O TU CONTENIDO, INDEPENDIENTEMENTE DE SI ${ENTITY_SHORT.toUpperCase()} FUE ADVERTIDA DE LA POSIBILIDAD DE TALES DAÑOS.

EN NINGÚN CASO LA RESPONSABILIDAD TOTAL DE ${ENTITY_SHORT.toUpperCase()} HACIA TI O TU NEGOCIO EXCEDERÁ EL MAYOR DE: (I) TRES (3) VECES LAS COMISIONES PAGADAS POR ${ENTITY_SHORT.toUpperCase()} A TI DURANTE EL MES ANTERIOR A LA FECHA EN QUE OCURRIERON LOS HECHOS QUE DIERON ORIGEN AL RECLAMO; O (II) DOS MIL DÓLARES ($2,000.00 USD).

## 11. Resolución de Disputas, Renuncia a Acciones Colectivas y Ley Aplicable

Cualquier controversia, disputa o reclamo que surja de o se relacione con este Acuerdo, el Programa de Afiliados, tu relación con ${ENTITY_SHORT}, tu actividad publicitaria, los pagos de comisiones, el seguimiento, la terminación o cualquier producto o servicio relacionado, que no pueda resolverse mediante negociación de buena fe dentro de los ciento veinte (120) días, se resolverá mediante arbitraje vinculante y confidencial administrado por la Asociación Americana de Arbitraje (“AAA”) bajo sus reglas de arbitraje comercial aplicables. El laudo dictado por el árbitro podrá registrarse en cualquier tribunal con jurisdicción.

Tú y ${ENTITY_SHORT} acuerdan que las disputas se resolverán únicamente de forma individual y no como acción colectiva, acción de grupo, acción de fiscal general privado, acción consolidada, acción representativa o arbitraje masivo, salvo que dicha renuncia esté prohibida por la ley aplicable.

Las leyes del Estado de ${GOVERNING_STATE} regirán este Acuerdo, sin atención a los principios de conflicto de leyes, salvo que la ley aplicable disponga lo contrario. La jurisdicción exclusiva para cualquier procedimiento judicial permitido relacionado con este Acuerdo serán los tribunales estatales o federales ubicados en ${VENUE}, salvo que la ley aplicable disponga lo contrario.

Esta sección no impide que ${ENTITY_SHORT} solicite medidas cautelares, medidas equitativas, ejecución de propiedad intelectual, ejecución de confidencialidad u otra medida de emergencia ante cualquier tribunal competente.

## 12. Indemnización

Aceptas proteger, defender, indemnizar y mantener indemne a ${ENTITY_SHORT}, sus directivos, gerentes, empleados, contratistas, propietarios, proveedores, licenciantes, proveedores de pagos, proveedores de telecomunicaciones, agentes, sucesores y cesionarios, frente a todos los reclamos, demandas, daños, pérdidas, responsabilidades, causas de acción, sentencias, acuerdos, sanciones, multas, comisiones, costos y gastos de toda clase, incluyendo honorarios razonables de abogados, que surjan de o se relacionen con: tu solicitud o participación en el Programa de Afiliados; tu publicidad, marketing, promociones, contenido o actividad de generación de prospectos; tu incumplimiento o presunto incumplimiento de este Acuerdo; tu violación o presunta violación de la ley, regulación, regla, política de plataforma o derecho de terceros aplicable; tus afirmaciones falsas, engañosas, no autorizadas o no sustentadas; tu mal uso de marcas, propiedad intelectual, activos de marca, información confidencial, datos de clientes o sistemas de seguimiento de afiliados; tus obligaciones fiscales, de pago, laborales, de contratista, de agencia, de protección de datos o comerciales; y cualquier reclamo de terceros relacionado con tus actos, omisiones, negligencia, mala conducta, fraude o violación de este Acuerdo.

Esta disposición subsiste expresamente a la terminación o cancelación de este Acuerdo.

## 13. Divisibilidad

Si alguna disposición de este Acuerdo se considera inválida, ilegal, inexigible, inconsistente con o contraria a cualquier ley, regla o regulación aplicable, dicha disposición se considerará modificada en la medida mínima necesaria para hacerla válida y exigible. Las demás disposiciones de este Acuerdo continuarán en pleno vigor y efecto.

## 14. Modificación y Enmiendas

${ENTITY_SHORT} puede modificar este Acuerdo, los Términos de Servicio, el Programa de Afiliados, los calendarios de comisiones, los métodos de pago, las ofertas elegibles, las reglas de seguimiento, las directrices de marca, los requisitos de divulgación y las reglas de publicidad en cualquier momento, con o sin aviso previo, salvo que la ley aplicable lo requiera de otro modo.

Las enmiendas o modificaciones serán vinculantes cuando se te envíen por correo electrónico, se publiquen en el panel de afiliados, se publiquen en un sitio web de la Compañía, se incluyan en términos actualizados del programa o se pongan de otro modo a disposición de los Afiliados. Tu participación continua en el Programa de Afiliados tras el aviso de términos actualizados constituye tu aceptación del Acuerdo modificado.

## 15. Confidencialidad

El Afiliado puede recibir información confidencial, propietaria, no pública o sensible de ${ENTITY_SHORT}, incluyendo, entre otros, tasas de comisión, datos de ventas, hojas de ruta de productos, estructuras de precios, información de clientes, información de prospectos, documentos internos, guiones, prompts, flujos de trabajo, información de software, arquitectura de la plataforma, procesos comerciales, información de proveedores, información de API, planes de marketing, funciones beta, materiales de capacitación y detalles de productos no publicados (“Información Confidencial”).

El Afiliado no divulgará, publicará, venderá, compartirá, copiará, aplicará ingeniería inversa, hará mal uso ni explotará la Información Confidencial, salvo lo necesario para participar en el Programa de Afiliados y solo según lo autorice ${ENTITY_SHORT}. Esta obligación de confidencialidad subsiste a la terminación o cancelación de este Acuerdo.

## 16. Protección de Datos y Manejo de Prospectos

El Afiliado es el único responsable de obtener todos los consentimientos, permisos, avisos y bases legales requeridos antes de recopilar, procesar, almacenar, transferir, cargar, vender, compartir o usar información de prospectos, clientes o personal.

El Afiliado no puede enviar a ${ENTITY_SHORT} datos de prospectos obtenidos mediante scraping, comprados, recolectados, obtenidos de forma ilegal o engañosa, o sin consentimiento. El Afiliado debe eliminar o devolver con prontitud los datos de la Compañía a solicitud y debe cooperar con ${ENTITY_SHORT} en relación con solicitudes de privacidad, solicitudes de eliminación, solicitudes de acceso, solicitudes de exclusión, requerimientos legales y revisiones de cumplimiento.

## 17. Auditoría y Revisión de Cumplimiento

${ENTITY_SHORT} puede revisar los sitios web, contenido, anuncios, embudos, páginas de aterrizaje, cuentas de redes sociales, campañas de correo, guiones, grabaciones de llamadas, fuentes de prospectos, fuentes de tráfico, divulgaciones y materiales promocionales del Afiliado para determinar el cumplimiento de este Acuerdo. El Afiliado acepta brindar cooperación y documentación razonables a solicitud.

${ENTITY_SHORT} puede exigir al Afiliado que elimine, revise, pause o suspenda cualquier anuncio, afirmación, sitio web, embudo, publicación, correo, guion, video, palabra clave, página de aterrizaje o método promocional que ${ENTITY_SHORT} determine que es no conforme, riesgoso, engañoso, fuera de marca o de otro modo inaceptable. El incumplimiento puede resultar en suspensión o terminación inmediata y pérdida de comisiones no pagadas.

## 18. Avisos

Todos los avisos requeridos bajo este Acuerdo deben enviarse por escrito a la Parte correspondiente. Los avisos a ${ENTITY_SHORT} deben enviarse a:

> ${ENTITY_NAME}
> ${ENTITY_ADDRESS}
> Soporte de Afiliados: affiliates@myorbisresults.com
> Cumplimiento: compliance@myorbisresults.com
> Legal: legal@myorbisresults.com

Los avisos al Afiliado pueden enviarse a la dirección de correo electrónico, dirección postal, cuenta del panel de afiliados u otro método de contacto proporcionado por el Afiliado.

## 19. Firma Electrónica y Aceptación

Aceptas que marcar la casilla de reconocimiento, escribir tu nombre legal y enviar este Acuerdo, usar un enlace de afiliado, iniciar sesión en el panel de afiliados, promover una oferta de ${ENTITY_SHORT}, aceptar pagos de comisiones o participar de otro modo en el Programa de Afiliados constituye una firma electrónica y la aceptación de este Acuerdo. Las firmas y los registros electrónicos tendrán el mismo efecto legal que las firmas originales y los registros en papel.

## 20. Aviso de Derechos de Autor

Copyright © ${YEAR} ${ENTITY_SHORT}. Todos los derechos reservados.

${ENTITY_SHORT}, MyOrbisVoice, MyOrbisLocal, MyOrbisWeb y todos los nombres, logotipos, nombres de productos, nombres de servicios, diseños, documentación, software, contenido, flujos de trabajo y activos de marca relacionados son propiedad de ${ENTITY_SHORT} o de sus respectivos propietarios.`
}
