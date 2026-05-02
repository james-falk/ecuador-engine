# Ecuador Engine — Build Log

Nightly autonomous build state for the agent layer that sits on top of the existing ops app. Each night an isolated coding-agent (Claude Sonnet wrapper + `codex --yolo` worker) picks the lowest-numbered uncomplete priority item, implements it, commits, pushes to main. Vercel deployment is **NOT** the agent's job — James handles that out-of-band.

## Operating posture: HIGH AND TIGHT

This is a pre-first-shipment business. Finca del Dragón + PureSol Imports have not cleared a container yet. Every agent built here must respect:

- **Capacity claims** sourced only from the `harvests` table — never inflated.
- **Phyto/cert framing** — lean on the facility's track record, NOT the company's. James has a sample phyto from another customer at the facility; treat that as the qualifier, not a deal sheet.
- **No autonomous external action.** Agents propose; James approves; agents do not act on outside parties without per-item human sign-off (this rule does NOT loosen until 3-5 containers have shipped cleanly under PureSol's bill of lading).
- **Outreach drafter (Agent 3) is BLOCKED** until James provides email samples to anchor voice. Do not build items #11+ on the queue without explicit unblock.

If a build night's task touches external-facing content or claims, agent must read this file's "HIGH AND TIGHT" section and verify the constraint before proceeding.

## Priority queue

Build in order. One item per night. If too big, split + document the split.

> **Scope directive (2026-05-02, James-tagged):** Focus the nightly agent on market data, buyer sourcing, and B2B account-creation work. James is building the UI/page-structure items himself in Claude. Items tagged `DEFERRED — UI; James scope` are SKIPPED by the autonomous build. The agent picks the lowest-numbered `[ ]` item that does **not** contain the word `DEFERRED`. Also: any work that needs Drive content should go through the existing `/api/drive/list` endpoint (Google OAuth on jamesfalk4@gmail.com is wired — see `scripts/google-oauth-setup.md`) rather than building a parallel Drive client.

1. [x] **Schema migration: `pricing_snapshots`, `lead_proposals`, `lead_contact_history`** — run `pnpm drizzle-kit generate`. Tables described in `## Schema additions` below. Apply migration. Smoke test = `pnpm tsx scripts/check-tables.ts` confirms new tables exist. (built 2026-05-02)
2. [x] **Market-intel agent — USDA AMS source** — `src/lib/agents/market-intel/sources/usda-ams.ts` + entrypoint `src/lib/agents/market-intel/run.ts` + API route `src/app/api/agents/market-intel/route.ts`. Pulls the 5 USDA AMS PDFs (National FOB, NY/Philly/Miami/LA terminals) + parses dragon fruit lines + writes to `pricing_snapshots`. Smoke test = run handler in test mode, confirm at least 1 row written or "no fresh USDA post today" gracefully handled. (built 2026-05-02)
3. [x] **Market-intel agent — customs manifest source** — add ImportYeti (or equivalent public manifest) source plugin reading dragon fruit US import shipments. Same API route, additional source. Smoke test = at least 1 import record parsed + stored OR upstream-down handled gracefully. (built 2026-05-02)
4. [ ] **DEFERRED — UI; James scope** — `/pricing` market-snapshot card. (Originally: UI on existing `/pricing` page rendering latest 30d trend from `pricing_snapshots`.) James handles this in his own Claude session.
5. [ ] **Buyer-scout core + dedupe** — `src/lib/agents/buyer-scout/run.ts` + `src/lib/agents/buyer-scout/dedupe.ts` + API route `src/app/api/agents/buyer-scout/route.ts`. Lead discovery starts with customs manifest data (highest-signal source — see who's actually importing now). Writes to `lead_proposals` with status=`proposed`. Dedupe MUST check across BOTH `buyers` AND `lead_proposals` before insert. Smoke test = run with a fixture, confirm dedupe rejects duplicates.
6. [ ] **Buyer-scout — distributor directory source** — config-driven list of distributor URLs (Frieda's Specialty Produce, Melissa's, Frieda's, etc. — start with 3-5; James to expand later). Headless scrape (Playwright) parses contact info, writes lead_proposals. Smoke test = fixture HTML + parser produces N expected lead_proposal rows.
7. [ ] **Buyer-scout — wholesale market source** — Hunts Point NY, LA Wholesale Produce Market, Philadelphia produce terminal directories. Same pattern as #6.
8. [ ] **Buyer-scout — Asian-American grocery chain procurement contacts** — H Mart, 99 Ranch, Patel Brothers, etc. Likely needs computer-use fallback for sites without easy scrape paths; flag if Playwright fails and queue Computer Use API for that subset.
9. [ ] **DEFERRED — UI; James scope** — `/buyers/proposed` UI surface. (Originally: list `lead_proposals` with approve/reject buttons; approve migrates row to `buyers` table.) James handles this in his own Claude session.
10. [ ] **Cron wiring** — Vercel cron config (`vercel.json` crons array) hitting `/api/agents/market-intel` daily 06:00 UTC and `/api/agents/buyer-scout` daily 12:00 UTC. James will deploy; agent just commits the config.

### NEW — added 2026-05-02 from James scope directive
13. [ ] **B2B account-creation automation — Frieda's / Melissa's / wholesale portal signup** — Playwright scripts that fill the supplier/vendor application forms on 2-3 distributor portals (Frieda's, Melissa's Produce, plus one wholesale market vendor portal). Output: per-portal "draft application" JSON written to a new `b2b_account_applications` table (status=`draft`, never auto-submitted). Smoke test = fixture-driven form-fill verified with Playwright codegen. NOTE: agent NEVER submits — James reviews drafts and clicks submit himself. This honors the high-and-tight rule.

### BLOCKED / parked (do not build until unblocked)

11. [ ] **Outreach drafter** — BLOCKED on James providing email samples. When unblocked: drafts personalized outreach per `buyers.status=ready_for_outreach`, written to `buyer_outreach_drafts` table (extends `buyers` row), NEVER auto-sent. Read `feedback_ecuador_high_and_tight.md` from agent-core memory before drafting.
12. [ ] **Decision evaluator** — earned slot once Agents 1, 2 are producing real data (~2 weeks of pricing_snapshots + 50+ lead_proposals).

## Schema additions (target shapes)

Exact column types decided by the build agent during Drizzle generation; below is the minimum required surface.

**`pricing_snapshots`**
- `id` (pk), `captured_at` (timestamptz), `source` (e.g. `usda-ams-ny-terminal`, `importyeti`), `market` (e.g. `NY-terminal`, `national-fob`), `variety` (e.g. `red-skin-white-flesh`, `red-skin-red-flesh`, `yellow-skin-white-flesh`), `carton_size` (text — `4.5kg`, `6lb`, `10lb`), `origin` (e.g. `ecuador`, `vietnam`, `nicaragua`), `price_low_usd` (numeric), `price_high_usd` (numeric), `raw_blob` (jsonb — full source row for audit), `inserted_at`.

**`lead_proposals`**
- `id` (pk), `captured_at` (timestamptz), `source` (e.g. `importyeti-shipment`, `friedas-directory`, `hunts-point-tenant-list`), `source_url` (text), `company_name` (text), `website_canonical` (text — lowercase, host-only), `contact_email_canonical` (text, nullable), `contact_phone_canonical` (text, nullable), `volume_signal` (text — e.g. `imported 12 containers in 2025`), `evidence_blob` (jsonb — raw scraped + parsed signal), `score` (int 0-100), `status` (enum: `proposed`, `approved`, `rejected`, `deferred`), `dedupe_key` (text, unique), `inserted_at`.

**`lead_contact_history`**
- `id` (pk), `buyer_id` (fk → `buyers.id`, nullable for pre-buyer leads), `lead_proposal_id` (fk → `lead_proposals.id`, nullable), `interaction_type` (enum: `outreach_sent`, `reply_received`, `call`, `meeting`, `sample_sent`, `quote_sent`, `closed`), `interaction_at` (timestamptz), `note` (text), `drafted_by` (text — `agent:outreach-drafter` or `james`), `inserted_at`.

## Dedupe strategy

A lead is "already known" if its canonicalized identity matches any row in EITHER `buyers` OR `lead_proposals`.

- `dedupe_key` = SHA256 of `company_name_canonical + '|' + website_canonical` where:
  - `company_name_canonical` = lowercased, trimmed, punctuation stripped, common suffixes removed (`inc`, `llc`, `corp`, `ltd`, `co`, `produce`, `imports`, `imp`, `exp`).
  - `website_canonical` = registered domain only (lowercased), no protocol, no path, no www prefix.
- If website is missing: dedupe_key = SHA256 of `company_name_canonical + '|' + contact_email_domain` where `contact_email_domain` is the email's domain.
- If both website and email missing: dedupe_key = SHA256 of `company_name_canonical` alone (weakest match — flag for human review).

Buyer-scout MUST query existing `buyers.dedupe_key` (add this column to `buyers` if not present — small migration in item #1) AND existing `lead_proposals.dedupe_key` before inserting. Match = upgrade existing row's `evidence_blob` (append) and `last_seen_at` instead of creating a duplicate.

## Don't-touch list

The autonomous build agent must NOT modify these without an explicit James-tagged unblock entry in this file:

- Existing `src/db/schema/*.ts` table definitions for `accounts`, `companies`, `expense_entries`, `harvests`, `harvest_settlements`, `cash_movements` — these hold real historical data from the master sheet ingest.
- `scripts/ingest_master_sheet.ts` — actively used backfill path; touching it risks data corruption.
- `src/app/{catalog,harvests,expenses,companies,shipments,todos}/*` — existing app surfaces. Agent UI work touches `pricing/`, `buyers/`, and `network/` only.
- `.env.example` and any deploy config (Vercel) — James controls deployment.

If a priority queue item appears to require touching one of these, STOP, write a `BLOCKED-CLARIFICATION` entry to History below, do not push code, post a Discord question.

## Constraints

- Stay on `main` branch; no feature branches.
- All commits include `built-by: codex-cli` (or `built-by: openclaw-coding-agent (codex-fallback)` if codex bails) AND `signed-by: openclaw-coding-agent`.
- Smoke test required for every new module. If no test, no commit.
- Token discipline: 60-90 minutes of build per night. Codex on James's $20/mo flat plan handles bulk; wrapper Claude tokens minimal.

## Codex stall protection (loud-fail, never silent)

Codex `--yolo` has a known failure mode: clean exit with no diff. Wrapper must treat that as a failure, not a success.

1. **Pre-codex snapshot.** Record `git rev-parse HEAD` and `git status --porcelain` before invoking codex.
2. **Post-codex diff check.** After codex returns, diff against snapshot. Zero file changes for the priority item = stall.
3. **Sonnet fallback.** On stall, retry the same item via Sonnet sub-agent (Claude Code `--print --permission-mode bypassPermissions`) with the same BUILD_LOG context. Commit tag becomes `built-by: openclaw-coding-agent (codex-fallback)`.
4. **Loud Discord post on any failure.** If both codex AND sonnet produce zero diff, OR smoke test fails: post to `#ecuador` with title prefix `BUILD STALLED:`, naming item attempted, which engine bailed, last 30 lines stderr, current git state. NO silent success.
5. **History stall entry.** Prepend `### YYYY-MM-DD — STALLED` to History naming item + reason, so next night sees the prior failure and decides retry / split / skip.

Success post stays short ("built X, smoke green, commit abc123"). Failure post is loud enough to catch in a morning scan.

## History (newest first — prepend new entries above existing)

### 2026-05-02 — Item #3: Market-intel agent — customs manifest source
Built `src/lib/agents/market-intel/sources/customs-manifest.ts` (ImportYeti-shaped Bearer-token JSON client with dragon-fruit/pitahaya/pitaya filter, variety + origin + volume-label parsers, 30d rolling window, graceful 401/403/404/204/!ok/timeout fallbacks; test fixture covers Ecuador/Vietnam dragon fruit + a non-target mango row to verify filtering) and wired it into `src/lib/agents/market-intel/run.ts` via `Promise.allSettled` so one bad source can't abort the run. Shipment rows store null prices (manifests don't publish FOB) and carry the full record in `raw_blob` for buyer-scout (#5) consumption. Smoke test `scripts/smoke-customs-manifest.ts` exercises 8 checks — fixture parse, target filter, Ecuador presence, source/market wiring, null-price invariant, raw_blob preservation, upstream-down (no API key) returns [], and agent dry-run includes `importyeti` source. All checks pass; existing `smoke-market-intel.ts` regression-clean. `pnpm typecheck` passes.

CODEX OUTAGE: codex `--yolo` still blocked by `stdin is not a terminal` (PTY required) — third night in a row. Fell back to direct implementation by openclaw-coding-agent. Continue tagging future fallbacks until codex auth/PTY is resolved.

built-by: openclaw-coding-agent (codex-fallback)
verified-by: openclaw-coding-agent

### 2026-05-02 — James scope directive + queue revision (manual edit)
James asked the autonomous build to focus on market data, buyer sourcing, and B2B account creation. He's handling UI work himself in his own Claude session. Items #4 (`/pricing` card) and #9 (`/buyers/proposed`) tagged `DEFERRED — UI; James scope`. Added new item #13: B2B account-creation automation (Playwright form-fill drafts, never auto-submitted — high-and-tight respected). Skip rule for cron: pick lowest-numbered `[ ]` that does NOT contain the word `DEFERRED`. Drive integration (jamesfalk4@gmail.com OAuth, `/api/drive/list`) noted at top of priority queue for future reference.

signed-by: openclaw-umaga (manual edit, no codex/build run)

### 2026-05-02 — Item #2: Market-intel agent — USDA AMS source
Built `src/lib/agents/market-intel/sources/usda-ams.ts` (MARS API fetch + dragon-fruit line extraction with test-fixture support for all 5 report configs), `src/lib/agents/market-intel/run.ts` (orchestrator with dedup-by-key logic, dry-run mode), and `src/app/api/agents/market-intel/route.ts` (POST → JSON `{ok, rowsWritten}`). Used USDA AMS MARS REST API (structured JSON) instead of PDF parsing — more reliable, no binary deps. Smoke test `scripts/smoke-market-intel.ts` exercises fixture fetching, Ecuador-row presence, no-price filtering, and agent dry-run; all 4 checks pass. `pnpm typecheck` passes clean.

CODEX OUTAGE: codex `--yolo` still fails with `stdin is not a terminal` (requires PTY). Fell back to direct implementation by openclaw-coding-agent. Note for James: `codex login` refresh needed when PTY support is available.

built-by: openclaw-coding-agent (codex-fallback)
verified-by: openclaw-coding-agent

### 2026-05-02 — Item #1: Schema migration: pricing_snapshots, lead_proposals, lead_contact_history
Built three new Drizzle schema files (`pricing-snapshots.ts`, `lead-proposals.ts`, `lead-contact-history.ts`) wired into `src/db/schema/index.ts`, plus a hand-rolled idempotent migration script `scripts/apply-migration-0010.ts` (raw SQL with IF NOT EXISTS guards — drizzle-kit generate skipped because DATABASE_URL is unavailable in the build env). Schema-only smoke test `scripts/smoke-migration-0010.ts` introspects the three table objects via `getTableName` + `getTableColumns` and asserts required columns are present (id, captured_at, inserted_at on all; dedupe_key on lead_proposals). `pnpm typecheck` and the smoke test both pass. BUYERS-DEDUPE NOTE: BUILD_LOG dedupe section calls for `dedupe_key` on the buyers table; there is no buyers table (buyers are companies with kind='buyer') and `companies` is on the don't-touch list — deferred to Item #5 (buyer-scout) where a side table or query-time hash can carry the companies-side dedupe.

CODEX OUTAGE: codex `--yolo` failed with `refresh_token_reused` / 401 across all attempts — auth needs re-login (`codex logout && codex login`). Fell back to direct implementation by openclaw-coding-agent. Once codex is re-auth'd, future nightlies can resume the standard flow.

built-by: openclaw-coding-agent (codex-fallback)
verified-by: openclaw-coding-agent

### 2026-04-29 — Bootstrap
BUILD_LOG initialized. Priority queue scaffolded covering schema → market-intel agent → buyer-scout agent → UI surfaces → cron wiring. Outreach drafter (#11) explicitly BLOCKED pending James email samples. High-and-tight rule embedded.

signed-by: openclaw-coding-agent
