# CONTRIBUTING.md

TicketRouter is a free static website that, given *where a stop happened*,
points a person at the official court or DMV page for the state where the
stop happened, which they use themselves. It does not search, store, or interpret anyone's tickets.

## One rule

**Only add official sources.** If the URL is not on a `.gov`, state judicial
branch, or state bar site — or is not otherwise the official page of the agency
in question — do not add it. See `docs/TICKETROUTER-SCOPE.md` for the locked
source table.

## Adding or editing a state file

1. Read `schema/jurisdiction.schema.json` (states) or `schema/pins.schema.json`
   (map pins) and `docs/TICKETROUTER-SCOPE.md`.
2. Edit `data/states/<ST>.yaml` (two-letter code; must match the file name).
   Values are single-line scalars (plain or quoted) — the vendored parser does
   not support multi-line values. Wrap long copy in quotes on one line.
3. Every card needs: `id`, `verification`, `source_url`, `last_verified`,
   `kind`, `agency`, `accepted_keys`, `cost`, `cost_free`, `limitations`,
   `for_intents`, `for_counties`, `weight`.
4. `verification` must be one of
   `unverified | link_ok | keys_documented | handoff_tested | disabled`.
   The router emits only `link_ok` or better — set `unverified` when in doubt
   and let CI complain if you route it.
5. Fee fields are "as printed on `source_url` that day," not market claims.
   If an FAQ page and a terms page disagree on a fee, say so in `cost_notes`
   and point at the terms page.
6. `accepted_keys` describes what the official form asks for — as text. Never
   add an `<input>` for an identity value on our pages.

## Verification workflow

- `node scripts/validate.mjs` — schema + policy checks (states and pins).
- `node scripts/build-data.mjs` — rebuilds `site/data/*.json`.
- `node scripts/build-pins.mjs` — rebuilds `site/data/pins-*.json`.
- `node --test tests/router.test.mjs` — router fixtures.
- `node --test tests/pins.test.mjs` — pin contract, coordinates, official hosts.
- `node scripts/check-links.mjs` — HEAD/GET against official URLs (cards and
  pins), follows redirects. Rows with `link_check: manual` (bot-blocked but
  human-verified) are reported separately, not failed.

## Adding or editing map pins

1. Edit `data/pins/<ST>.yaml` (two-letter code; must match the file name).
   Pins never carry identity fields and never imply ticket search.
2. Every pin needs: `id`, `state`, `county` (must exist in
   `data/states/<ST>.yaml`), `name`, `address`, `lat`, `lng`, `url`, `kind`
   (`courthouse` for now — new kinds need a validator update).
3. `url` must be `https://` on an official host (same allowlist as cards) and
   should be reused verbatim from the state file's card for that agency.
   Exception: an official site with human-verified broken TLS may use the
   working `http://` address, but only when `verification_note` documents the
   broken TLS (certificate error). Pins also support `link_check: manual`
   (mirroring cards): use it when the site blocks automated checks but loads
   for human visitors, and always add a `verification_note` explaining what
   was human-verified and why automation is waived.
4. Coordinates must fall inside the state's bounding box in
   `scripts/validate.mjs` (`STATE_BOUNDS`) — a pin outside the box fails
   validation, which catches bad geocodes.

## Never do

- Add identity inputs (`dl`, `vin`, `license`, `plate`, `dob`, `ssn`) to any page.
- Add a search, scraper, form submission, CAPTCHA solver, or account.
- Add case-specific advice or insurance-impact claims.
- Invent URLs. Verify the page loads, read it, and copy facts from it.
- Copy third-party "statewide portal scorecards" into docs.
