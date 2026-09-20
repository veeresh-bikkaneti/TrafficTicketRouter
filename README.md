# TicketRouter

An open-source, static **router of official U.S. court and DMV pages** for moving
violations (speeding, DUI, other traffic infractions). We do not search tickets.
We show you the official page.

**v1 covers Nebraska only.** One state file: `data/states/NE.yaml`.

## What this is

- A directory of verified official URLs: statewide court case search, citation
  payment, county courts, DMV driving-record requests, legal self-help.
- A 3-step wizard: *what do you need?* → *where?* → destination cards with the
  official links, fees, lags, and limitations.
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

## The VIN table

| What you have | Can it find a speeding ticket? |
|---|---|
| Citation number | Yes — on the court's official site for that county |
| Driver's license | Sometimes — on portals that accept DL search |
| Name | Sometimes — where the portal supports name search |
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
  data/states/NE.yaml     only state file in v1
  content/handle-it.md    general "how to handle it" education
  site/                   static site (GitHub Pages)
    index.html check.html vin.html learn.html legal.html
    css/app.css js/router.js js/ui.js
    data/ne.json          built from YAML (do not hand-edit)
  scripts/validate.mjs    schema + policy checks
  scripts/build-data.mjs  YAML -> site/data/ne.json
  scripts/check-links.mjs reachability check for official URLs
  scripts/yaml.mjs        minimal vendored YAML-subset parser (zero deps)
  tests/router.test.mjs
  tests/fixtures/routes.json
  .github/workflows/ci.yml
```

## Data is the product

Contributors edit YAML in `data/states/`. The UI reads compiled JSON.
See [CONTRIBUTING.md](CONTRIBUTING.md) for the entry template and the
verification rules (every routed URL verified within 90 days).

## Develop

Zero dependencies. Plain Node 18+.

```sh
node scripts/validate.mjs        # schema + policy checks on data/states/*.yaml
node scripts/build-data.mjs      # writes site/data/ne.json
node --test tests/router.test.mjs
node scripts/check-links.mjs     # HEAD/GET every official URL
```

Serve `site/` with any static server to click through the wizard.

## License

Apache-2.0. See [LICENSE](LICENSE) and [LEGAL.md](LEGAL.md).
