# TicketRouter — Scope (v1, Nebraska)

**Status: PROVISIONAL.** Reconstructed 2026-09-20 from official sources. The locked
`TICKETROUTER-SCOPE.md` was not in the upload set, so every URL below was individually
verified against an official `.gov` / judicial-branch / county source on 2026-09-20.
If Veeresh uploads the locked SCOPE, it supersedes this file. If any instruction
conflicts with this file, follow this file.

## Locked scope

- v1 covers **Nebraska only**. Exactly one state file: `data/states/NE.yaml`.
- Do **not** generate 49 empty state files.
- Moving violations only: speeding, DUI, other traffic infractions/misdemeanors.
- Router emits only rows with `verification` ∈ `link_ok | keys_documented | handoff_tested`.
- No identity inputs anywhere in the DOM (see hard refusals in the agent prompt).
- Parking / toll / red-light-camera: not a v1 job. May appear later as labeled side cards.

## Verified Nebraska URL allowlist

Use **only** these URLs in v1, plus the two conditional additions in §3.

### 1. JUSTICE one-time court case search (statewide)
- URL: `https://www.nebraska.gov/justicecc/ccname.cgi`
- Terms: `https://www.nebraska.gov/justicecc/terms_and_conditions.html`
- **$17.00 per search** — charged even when no records are found. Name-based search
  (party name, not a witness), up to 30 cases, results accessible for 3 days.
- Covers criminal, civil, **traffic**, juvenile, probate in **all 93 county and district courts**.
- **24-hour lag** between case entry and appearance in search.
- Card must **NOT** say free. Limitation line must mention the lag and the no-results-still-charged rule.

### 2. Nebraska Judicial Branch Internet Payment System — ePayments (statewide)
- URL: `https://www.nebraska.gov/apps-courts-epayments/public/index`
- Pay ticket/citation online. Paying online = waiver of appearance + plea of guilty.
- Minimum **$1.25 additional charge per case/ticket**. Visa, MasterCard, Discover, eCheck.
  Payments must total less than $5,000.
- **Excludes Douglas County.**
- Lost ticket + no citation number: the official page says to use the "let's chat" option
  or contact the court office of the county where ticketed.
- Waiver info (referenced on official waiver forms; verify reachability in check-links,
  drop if unreachable): `https://nebraska.gov/courts/citations/`
- Limitation: if the citation is marked "court appearance required" (DUI, driving on
  suspended license, no insurance, etc.), do **not** pay online before appearing.

### 3. Nebraska DMV — copy of OWN driving record (history path)
- URL: `https://dmv.nebraska.gov/faq/how-do-i-get-copy-my-driving-record`
- **$15.00 per record.** Online service linked from that page; viewable immediately
  upon purchase (credit card or e-check).
- This is the **"have I ever received a violation"** path. Card must label it:
  **convictions / points / suspensions — not pending tickets.**
- Do **not** route to anyone-else's record lookup. Self-check only.

### 4. Douglas County Court (Judicial Branch page)
- URL: `https://supremecourt.nebraska.gov/douglas-county-court`
- Criminal/Traffic Division, Hall of Justice, 1701 Farnam Street, 2nd Floor,
  Omaha, NE 68183. Main phone (402) 444-5387.
- Note on card: Douglas County is **excluded** from the state ePayments system.

### 5. Lancaster County (county path = statewide cards + court contact)
- County Court of Lancaster County, Criminal/Traffic: (402) 441-8959.
  Justice and Law Enforcement Center, 575 South 10th Street, Lincoln, NE 68508.
- County traffic info (County Attorney, traffic division; STOP program):
  `https://www.lancaster.ne.gov/Faq.aspx?QID=726`

### 6. Self-help (official)
- `https://www.supremecourt.nebraska.gov/selfhelp` — referenced in the official
  Judicial Branch legal-resources brochure. **Verify in check-links; drop if unreachable.**
- `https://lawhelpne.legalaidofnebraska.org/` — Legal Aid of Nebraska self-help
  (information, forms, and links for self-represented persons).

### 7. Sarpy County
- No separately verified portal URL. Sarpy card = statewide JUSTICE + ePayments +
  self-help + DMV inheritance, plus Sarpy County Court contact via the Judicial
  Branch court directory (text only, no URL unless verified).
- The agent **may** add the official `supremecourt.nebraska.gov` Sarpy county-court
  page **only** if it returns HTTP 200 and is verifiably the official Judicial
  Branch page for Sarpy County Court; document the verification date in the YAML.
  No other invented URLs.

## Corrections to earlier research
- The 50-state outline listed the NE DMV record at $7.50. The official DMV FAQ
  (verified 2026-09-20) says **$15.00**. Use $15.00.
- The outline's Nebraska deep URLs were marked "unverified". Every URL above
  replaces them.

## v1 done checklist (from agent prompt)
Repo skeleton + Apache-2.0 LICENSE + README (non-goals + VIN table) → JSON Schema +
`data/states/NE.yaml` (URLs above only) → `scripts/validate.mjs` → `scripts/build-data.mjs`
→ pure `router.js` + fixtures (Lancaster lost-paper; history→DMV $15; VIN-only explainer;
JUSTICE card not free) → static pages per design bar → `scripts/check-links.mjs` →
GitHub Action (validate + router tests + link check) → LEGAL.md. Done when the SCOPE
checklist is green and `grep -E 'name="(dl|vin|license|plate|dob|ssn)'` returns nothing.
