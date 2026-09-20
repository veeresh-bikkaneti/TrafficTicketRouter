# TicketRouter — Strategy

Date: 2026-09-20. Status: locked.

## The problem we actually solve

A person thinks they may have a speeding ticket, DUI, or other moving violation. They do not know which official door to knock on. There is no national ticket file. Court portals and DMVs do not talk to each other in a way a citizen can query. Commercial people-search sites warehouse records and have already been fined for treating traffic tickets like criminal history.

We do not become that warehouse. We become the map.

## What we build

An open-source, static, nationwide **directory + guided router** of official sources for moving violations (speeding, DUI, other traffic infractions/misdemeanors). The user picks where the stop happened. We show the official court, citation-pay, self-help, and DMV driving-record pages for that place. They leave our site and type their own identifiers on the official form.

We never search, scrape, store, or interpret a record.

## Why this is the only 50-state path that holds

| Approach | Can it cover 50 states? | Legal posture |
|---|---|---|
| National VIN/DL search API | No — no such API exists | DPPA + court ToS + CFAA |
| Background form-fill + screenshot | Looks like 50-state search | FCRA assembly + unauthorized access |
| TruthFinder-style warehouse | Yes, commercially | Data broker + FTC injunction risk |
| Official-source directory + router | Yes, incrementally | We never hold the record |

50-state coverage means **50 verified directory files**, not one backend that queries every court.

## Two record types (do not merge)

1. **Court citation** — pending or recent ticket. Lives in the county / municipal / traffic court (or statewide court CMS) where the stop happened. Keys on the official site: citation #, sometimes DL or name+DOB.
2. **DMV driving record** — convictions, points, suspensions *after* the court reports them. This is the “ever received / is my record clean” path. Under the Driver License Compact, many out-of-state moving convictions appear on the **home-state** record. Own-record request is a DPPA-permitted use. We link; we do not pull.

VIN, title, and plate do not find speeding tickets. Plate can find parking/camera/toll in some cities. We say that on page one.

## Geographic strategy

- **v1:** Nebraska. Traffic is county court. JUSTICE is a paid statewide name/case search. DMV abstract is $15. Seed Lancaster, Douglas, Sarpy plus statewide cards.
- **v1.1:** Remaining NE counties as directory rows that inherit statewide JUSTICE + ePayments + DMV.
- **v2:** Add states one file at a time. Priority = population + how broken the official path is (fragmented municipal/JP systems first: TX, OH, MO).
- **Map (ESRI or MapLibre):** phase 2. Pins are YAML rows. No map until NE data is `link_ok`.

Do not generate 49 empty state files to look national.

## Product principles

1. Official links only. Unverified rows never route.
2. Wrong confident route is worse than no route.
3. “Not found” on a destination site is a source miss at time T, not proof of no ticket.
4. General education + official next-step pages. No “you should fight this.”
5. Freshness is the product. Stale URL gets a badge, then disable.
6. Self-check UX only. No name field that invites people-search.

## Economics and license

Free. Apache-2.0. GitHub Pages. The cost is maintainer hours to verify URLs, not compute or counsel for a data plane.

## Success

A user in Lincoln can, in under two minutes, open the correct official page for (a) a lost paper ticket in Lancaster County and (b) their own DMV driving record — without typing a DL number into our site.
