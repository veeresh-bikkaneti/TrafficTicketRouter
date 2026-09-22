# TicketRouter

**Live site:** https://veeresh-bikkaneti.github.io/TrafficTicketRouter/
(deployed from `master` via GitHub Pages)

TicketRouter is a free static website that, given *where a stop happened*,
points a person at the official court or DMV page for the state where the
stop happened, which they use themselves. It does not search, store, or
interpret anyone's tickets.

**Covers all 50 states.** Fifty state files in `data/states/` (2,500+ county
court, payment, and DMV cards), fifty pin files in `data/pins/` (2,500+
courthouse addresses with verified coordinates, shown on the map).

## What this is

- A directory of verified official URLs: statewide court case search, citation
  payment, county courts, DMV driving-record requests, legal self-help.
- A 3-step wizard: *state* → *county* → *what you still have* (choice buttons only — no identity inputs, nothing stored) → destination cards with the
  official links, fees, lags, and limitations.
- A US-only courthouse map (`map.html`): four basemaps (Street, Satellite,
  Terrain, Night — Esri + CARTO, no API keys), a client-side courthouse
  search box, and screen-space clustering. Panning and zooming are clamped to
  the United States; it never shows a world view.
- A VIN / plate / title explainer that says plainly what those identifiers can
  and cannot find.

## What this is not (non-goals)

- **Not a ticket search.** We never query a court or DMV. You type your own
  information on the official site.
- **Not a record warehouse.** No scraping, no CAPTCHA bypass, no credential
  capture, no database of people.
- **Not legal advice.** General information plus official links only. No
  "you should fight this ticket," no insurance advice.
- **Not a people-search product.** There are no identity fields anywhere in the
  site. Self-check only.
- **Not accounts, payments, or analytics-of-lookups.** No Stripe, no tracking
  of who looked up what.

## Security

Every page ships a strict Content-Security-Policy and `no-referrer` policy.
Nothing is typed here that leaves the browser: no cookies, no `localStorage`,
no analytics. The only third-party hosts ever contacted are `cdn.jsdelivr.net`
(fonts + the MapLibre library, pinned by version with Subresource Integrity),
`server.arcgisonline.com`, and `a.basemaps.cartocdn.com` (map tiles). Details
in [`site/legal.html`](site/legal.html).

## The VIN table

| What you have | Can it find a speeding ticket? |
|---|---|
| Citation number | Yes — on the court's official site for that county |
| Driver's license | Only on portals that explicitly offer DL search — for example, Nebraska's JUSTICE searches by name, not DL |
| Name | Sometimes — where the portal supports name search (for example, Nebraska's JUSTICE does, $17/search) |
| Plate number | Only camera / parking / toll violations, in some cities |
| VIN / title / registration | **No.** These identify the vehicle, not the driver. A speeding ticket is issued to a person. |

## Repo layout

```
ticketrouter/
  LICENSE                 Apache-2.0
  README.md
  LEGAL.md
  CONTRIBUTING.md
  schema/jurisdiction.schema.json
  schema/pins.schema.json
  data/states/*.yaml      50 state files (cards, counties, DMV links)
  data/pins/*.yaml        50 pin files (courthouse lat/lng + official URLs)
  content/handle-it.md    general "how to handle it" education
  site/                   static site (GitHub Pages)
    index.html check.html vin.html learn.html legal.html map.html
    css/app.css js/router.js js/ui.js js/map.js js/combo.js js/site.js
    data/<st>.json        built from YAML (do not hand-edit)
    data/pins-<st>.json   built from YAML pins (do not hand-edit)
    data/states-manifest.json  50 states, built
    data/pins-manifest.json    states with pin files, built
  scripts/validate.mjs    schema + policy checks
  scripts/build-data.mjs  YAML -> site/data/<st>.json + states-manifest.json
  scripts/build-pins.mjs  YAML pins -> site/data/pins-<st>.json + pins-manifest.json
  scripts/check-links.mjs reachability check for official URLs
  scripts/state-bounds.mjs per-state lat/lng bounds, used to sanity-check pins
  scripts/yaml.mjs        minimal vendored YAML-subset parser (zero deps)
  tests/router.test.mjs
  tests/pins.test.mjs     pin data + map.html/map.js contract checks
  tests/fixtures/routes.json
  .github/workflows/ci.yml           validate + build + test + check-links
  .github/workflows/deploy-pages.yml validate + build + test, then publish site/
```

## Data is the product

Contributors edit YAML in `data/states/`. The UI reads compiled JSON.
See [CONTRIBUTING.md](CONTRIBUTING.md) for the entry template and the
verification rules (every routed URL verified within 90 days).

## Develop

Zero dependencies. Plain Node 18+.

```sh
node scripts/validate.mjs        # schema + policy checks on data/states/*.yaml + data/pins/*.yaml
node scripts/build-data.mjs      # writes site/data/<st>.json + states-manifest.json
node scripts/build-pins.mjs      # writes site/data/pins-<st>.json + pins-manifest.json
node --test tests/router.test.mjs
node --test tests/pins.test.mjs
node scripts/check-links.mjs     # HEAD/GET every official URL
```

Serve `site/` with any static server to click through the wizard and the map.

## License

Apache-2.0. See [LICENSE](LICENSE) and [LEGAL.md](LEGAL.md).
