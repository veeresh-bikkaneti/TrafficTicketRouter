# TicketRouter — Locked Scope (agent contract)

Date: 2026-09-20. Status: locked for v1 implementation.
This file wins over the old PBR, Plan v1 prose, and any agent improvisation.

## One-sentence product

A free static website that, given *where a stop happened*, points a person at the official Nebraska court or DMV page they must use themselves. It does not search, store, or interpret anyone’s tickets.

## In scope for v1 (build only this)

1. Repo + Apache-2.0 + README/LEGAL/CONTRIBUTING that state the sentence above.
2. JSON Schema + YAML for jurisdictions.
3. Seed data for **Nebraska only**, with live official URLs:
   - Statewide court case search (JUSTICE, paid, name/case, lag).
   - County courts that hear traffic: Lancaster, Douglas, Sarpy (directory rows; traffic venue is county court in all 93 counties).
   - Official pay/waiver path.
   - Official judicial-branch traffic self-help.
   - Official DMV own-record request (the “ever received” path).
   - Official “lost my ticket” instruction: contact the county court or use the payment site’s help — we do not invent a lookup.
4. Static wizard: State → County → What you still have (none / citation # fragment as *label only*, not an input we store) → destination cards.
5. Destination cards: agency name, official URL (new tab, `rel="noopener"`), accepted keys **as text**, fee, lag, last verified, limitations.
6. VIN/title page: explicit “not a ticket search.”
7. Validators: schema + URL HEAD/GET check in CI.
8. Router fixtures that fail if we claim JUSTICE is free or accepts VIN.

## Out of scope (refuse these tasks)

- All other states in v1 (no 50 empty YAML files).
- DL, name, DOB, plate, VIN, title **input fields** in our HTML.
- Submitting a search to JUSTICE, DMV, or any court on the user’s behalf.
- Scrapers, puppeteer, CAPTCHA, credential capture, browser extensions.
- Accounts, databases, analytics of lookups, Stripe, paid concierge.
- Case-specific advice (“you should fight this,” “this won’t hit insurance”).
- People-search, employer/landlord/insurer modes.
- Paying a fine as a proxy.
- Claiming “search all US tickets” or “VIN ticket history.”

## Official Nebraska sources (use these URLs; do not invent)

| Role | Official URL | Verified fact |
|---|---|---|
| Traffic self-help | https://nebraskajudicial.gov/self-help/traffic | Traffic offenses are heard in **county court**. |
| Traffic extra info | https://nebraskajudicial.gov/self-help/traffic/additional-information-traffic-cases-nebraska | Waiver allowed only if the citation is marked; statewide waiver/fine schedule exists. |
| JUSTICE one-time case search | https://www.nebraska.gov/justicecc/ccname.cgi | Covers all 93 county + district courts including traffic. Search is by **party name** (and related filters), **not DL/VIN**. Terms: **$17/search**, no-hit still charged, 24h lag, results ~3 days, max 30 cases. FAQ pages still mention $15 — YAML `cost_notes` must say “confirm fee on the terms page; $17 as of 2026-09-20.” |
| JUSTICE terms | https://www.nebraska.gov/justicecc/terms_and_conditions.html | $17 fee language. |
| Court calendars | https://nebraskajudicial.gov/e-services/court-calendars | Hearing dates by date or last name. Not a ticket warehouse. |
| Pay ticket / citation | https://www.nebraska.gov/apps-courts-epayments/ | Official Judicial Branch Internet Payment System. Processing fee on top of fine. Lost ticket → chat or **county court where issued**. Do not pay online if waiver is not allowed / appearance required. |
| ePayments explainer | https://nebraskajudicial.gov/e-services/epayments | Same system; court info line (888) 342-6395. |
| DMV own record | https://dmv.nebraska.gov/dvr/obtaining-driving-record | **$15**/record. Online, mail, in person. Identity + permitted-use rules (Nebraska Uniform MVR Disclosure Act / DPPA analog). Convictions history — not a pending-ticket portal. |
| DMV online record app | https://www.nebraska.gov/dmv/dlrcc/index.cgi | Immediate view on purchase. |
| DMV “how do I pay a ticket” | https://dmv.nebraska.gov/faq/how-can-i-pay-my-traffic-or-parking-ticket | Points at the Judicial Branch payment system, not a DMV ticket file. |
| Title inquiry | DMV online services list (title inquiry ≠ tickets) | Do not route VIN/title here as a ticket search. |

## Journeys v1 must implement

**J1 — Lost paper, I know the county.**  
Pick Nebraska → pick county → show: (a) that county court + clerk path, (b) ePayments “lost ticket” note, (c) JUSTICE paid name search with fee/lag warnings, (d) self-help traffic page. User leaves our site.

**J2 — Have I ever gotten a ticket?**  
Explain court portals ≠ lifetime history. Card: DMV driving-record request, $15, what it usually shows (reported convictions / points / actions), what it usually does not (brand-new unpaid citations).

**J3 — How do I handle it (general)?**  
Link official pages only: pay/waiver, appearance if required, self-help traffic, state bar lawyer referral. Banner: not legal advice.

**J4 — I only have a VIN / title / plate.**  
Dead-end explanation. Offer J1/J2. No search.

## Data rules

- Every YAML row: `source_url`, `last_verified` (ISO date), `verification` ∈ `unverified | link_ok | keys_documented | handoff_tested | disabled`.
- Router emits only `link_ok` or better.
- Never copy unverified “22/14/14 statewide portal” scorecards into README.
- Fee fields are “as printed on source_url that day,” not market claims.

## v1 definition of done

An agent is done when all of these are true:

- [ ] `ticketrouter/` exists with LICENSE Apache-2.0
- [ ] Homepage first screen: “We do not search tickets”
- [ ] Zero identity `<input>` names (`dl`, `vin`, `license`, `plate`, `dob`, `ssn`)
- [ ] `data/states/NE.yaml` uses the URLs in the table above
- [ ] JUSTICE card states paid + name search + 24h lag
- [ ] DMV card is separate from court cards
- [ ] VIN path cannot return a court search URL labeled as VIN lookup
- [ ] `scripts/validate.mjs` and link check pass on seeded URLs
- [ ] Tests cover Lancaster vs “I only have a VIN”

Anything else is a later phase. Do not start CA, KS, MO, or a 50-state map until this checklist is green.
