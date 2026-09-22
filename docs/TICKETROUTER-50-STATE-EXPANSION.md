# TicketRouter — 50-state expansion (2026-09-21)

A free static website that, given where a stop happened, points a person at
the official court or DMV page they must use themselves. It does not search,
store, or interpret anyone's tickets. This definition is unchanged from the
Nebraska v1 scope (`docs/TICKETROUTER-SCOPE.md`); only the geographic coverage
has expanded.

## What changed from v1

- Coverage: one verified data file per state (`data/states/<ST>.yaml`), plus
  courthouse pins (`data/pins/<ST>.yaml`) for every state, instead of Nebraska only.
- A state ships only when every routed URL has been verified against an
  official source.
- Per-state `official_hosts`: each state file declares the official host
  suffixes its cards and pins use. Automation checks every URL against the
  declaring state's list; human review confirms each declared host is genuinely
  official (.gov or an official court/county domain).
- The frontend is manifest-driven: `site/js/ui.js` loads any of the 50 state
  files from `site/data/states-manifest.json`, and `site/js/map.js` renders all
  courthouse pins from `site/data/pins-manifest.json`.

## What did not change

- No ticket search, no stored records, no database of people, no PII fields on
  this site. Users type their own information on the official site.
- Official links only: every card's host must appear in that state's
  `official_hosts`, and any non-government or vendor-operated host must pass
  human trust review before it is presented as official.
- Venue honesty: where courts are fragmented (municipal/mayor's/county/magistrate),
  cards name a representative venue and tell the user to confirm the exact venue
  with the county clerk — never guess.
- Verification honesty: `link_check: manual` cards must carry a `verification_note`
  explaining what a human verified, on which official source, and when.
  Bot-blocked official sites (HTTP 403 to automation) are browser-verified, never
  assumed.
- Never fabricate: if an official traffic-court page, address, or coordinate
  cannot be verified, the card/pin is omitted and the gap is logged. Every
  omission is documented in the relevant pin file's header.

## Dataset snapshot (2026-09-21)

- 50 state files, 50 pin files.
- 3,052 counties/county-equivalents enumerated; 2,594 cards; 2,548 courthouse pins.
- Card-type coverage is uneven by design: 44/50 states have per-county court
  cards (AK, AL, CT, MN, NH, NM ship statewide guidance cards instead of
  per-county cards), 21/50 have DMV cards, 9/50 have statewide court search,
  10/50 have payment portals. The site says so — it never implies a card type
  exists where it doesn't.
- Coordinate sources: official street addresses geocoded via Nominatim and
  cross-checked against a second source (OSM place data or the county's own map).
- Pin backfill history: CA's 48-pin file landed first, then its 10 remaining
  counties (verified traffic venues — e.g. Riverside traffic is heard in
  Moreno Valley, not the Historic Courthouse). The last six pinless states
  (AK, AL, CT, MN, NH, NM) were backfilled the same day against official
  sources, with CT's judicial-district quirk and AK's shared courthouses
  documented in the file headers.

## Known follow-ups

- `site/learn.html` is a Nebraska-only guide on a nationwide site; it now
  carries a scope notice pointing out-of-state users to the check and map.
  Expanding the guide state-by-state is content work, not data work.
- GitHub Pages is not yet enabled; `.github/workflows/pages.yml` deploys
  `./site` on push to `master` once the Pages feature is turned on in repo
  Settings (source: GitHub Actions).
