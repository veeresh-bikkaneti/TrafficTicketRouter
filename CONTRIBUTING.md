# CONTRIBUTING.md

## One rule

**Only add official sources.** If the URL is not on a `.gov`, state judicial
branch, or state bar site — or is not otherwise the official page of the agency
in question — do not add it. See `docs/TICKETROUTER-SCOPE.md` for the locked
source table.

## Adding or editing a state file

1. Read `schema/jurisdiction.schema.json` and `docs/TICKETROUTER-SCOPE.md`.
2. Edit `data/states/<ST>.yaml` (two-letter code; must match the file name).
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

- `node scripts/validate.mjs` — schema + policy checks.
- `node scripts/build-data.mjs` — rebuilds `site/data/*.json`.
- `node --test tests/router.test.mjs` — router fixtures.
- `node scripts/check-links.mjs` — HEAD/GET against official URLs, follows
  redirects. Rows with `link_check: manual` (bot-blocked but human-verified)
  are reported separately, not failed.

## Never do

- Add identity inputs (`dl`, `vin`, `license`, `plate`, `dob`, `ssn`) to any page.
- Add a search, scraper, form submission, CAPTCHA solver, or account.
- Add case-specific advice or insurance-impact claims.
- Invent URLs. Verify the page loads, read it, and copy facts from it.
- Copy third-party "statewide portal scorecards" into docs.
