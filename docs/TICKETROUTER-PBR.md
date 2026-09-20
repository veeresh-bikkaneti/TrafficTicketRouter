# TicketRouter — Product & Business Requirements v1

Date: 2026-09-20. Replaces paid-concierge PBRs and the “search any VIN/DL” brief.

## 1. Decision

Build an open-source static router of official moving-violation sources. Do not build a record platform, a scraper, a paid concierge, or a people-search box.

## 2. Users

Primary: a licensed driver who lost a citation, drove through another county/state, or wants to see if a past speeding/DUI matter still sits on a court docket or a DMV abstract.

Secondary: legal-aid and court self-help staff who need a maintained list of official URLs.

Not a user: employers, landlords, insurers, skip-tracers.

## 3. Jobs to be done

1. “I lost the paper. Where do I look in this county?”
2. “Have I ever had a moving violation on my record?”
3. “What are the official options to pay, appear, or request school — in general?”
4. “I only have a VIN / plate. Will that find a speeding ticket?” → No. Redirect.

## 4. In / out

**In v1**

- Static site (GitHub Pages).
- YAML directory + JSON Schema.
- Nebraska statewide + Lancaster / Douglas / Sarpy.
- Wizard: intent → state → county → destination cards.
- VIN/title explainer.
- General handle-it module with official links.
- CI: schema + URL check.
- README, LEGAL, CONTRIBUTING, Apache-2.0.

**Out forever unless a new PBR is written**

- Any input that captures DL, name, DOB, SSN, plate, VIN, title.
- Server-side search, form-fill, screenshot relay, puppeteer.
- Accounts, analytics of who looked up what, Stripe.
- Case-specific legal advice.
- Parking / toll / red-light as a primary job (may appear later as labeled side cards).
- ESRI map in v1 (v2, data-gated).

## 5. Information architecture

```
Home
  What this is / is not
  Start check
Check
  1. What do you need?  (lost paper | history | how to handle | I only have a VIN)
  2. Where?             (state → county)
  3. Destinations       (cards, official URLs)
Learn
  Pay / appear / school / FTA — general + official links
Legal
  Not advice, not a search, not a consumer report
```

## 6. Destination card contract

Every card must show:

- Agency name and kind (county court / statewide CMS / DMV / pay portal / self-help)
- Official URL (new tab, `rel="noopener noreferrer"`)
- Accepted keys **as text** (“this form asks for citation number or name”)
- Cost and lag, copied from the source page date
- Last verified date
- Limitation line (“24-hour lag”, “convictions not pending tickets”, “waiver only if marked on citation”)

Router may emit only rows with `verification` ∈ `link_ok | keys_documented | handoff_tested`.

## 7. Nebraska seed (required URLs)

See `TICKETROUTER-SCOPE.md`. Do not invent others. JUSTICE is paid name/case search (~$17 terms page). DMV own-record is $15. Traffic venue is county court.

## 8. Non-functional

- Works with JS on; core copy readable if JS off.
- WCAG 2.2 AA: contrast, focus, labels, `prefers-reduced-motion`.
- No third-party trackers.
- Mobile first.
- Hosting: GitHub Pages. Optional custom domain later.

## 9. Metrics (non-commercial)

- Coverage: verified NE statewide cards + 3 counties in v1.
- Freshness: every routed URL verified within 90 days.
- Correctness: user-reported wrong-link rate.
- Do not measure “tickets found.” We do not find tickets.

## 10. Risks

| Risk | Mitigation |
|---|---|
| User thinks we searched | Homepage + card footer: “We did not search any database.” |
| Stale URL | CI + 90-day badge + disable |
| UPL creep | Maintainer rule: reject advice PRs |
| People-search misuse | No identity fields |
| Scope to 50 empty states | v1 is NE only |

## 11. Phases

- P0 Legal copy + schema
- P1 NE data + static UI
- P2 Tests + CI + GitHub Pages
- P3 Remaining NE counties
- P4 Next state file
- P5 Map (ESRI or MapLibre) over verified pins only

## 12. Open decisions (do not block v1)

- Map vendor: ESRI vs MapLibre. Default MapLibre if no ESRI key.
- License already picked: Apache-2.0.
- Brand name: TicketRouter working title.
