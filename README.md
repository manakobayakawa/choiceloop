# ChoiceLoop

**Don't just optimize for being found. Optimize for being chosen.**

An evidence-led AI growth experiment workspace for Café Athena, 1846 Garnet Avenue, San Diego. Built for the NYU SPS × Pulse Foundry Hackathon.

**Live demo:** https://choiceloop-athena-lab.manakobayakawa.chatgpt.site

## What works

- Inspect the preserved 100-scenario pool and frozen 25-case MVP with exact S IDs, queries, and fingerprints.
- Import/export validated experiment bundles and retain immutable baseline/retest records.
- Inspect original journeys, evidence excerpts, source URLs, timestamps, uncertainty, and pending proposals.
- Persist owner-scoped workspaces in native Sites D1; store original files in R2.
- Recompute matched comparisons with explicit denominators, compatibility checks, and source hashes.
- Keep the separate proposed P-ID / 24-case workspace, versioned drafts, approval invalidation, and manual handoff workflow.

## Current result: Information sufficiency

| Historical rule-evaluator output | Baseline | Retest |
|---|---:|---:|
| Information-sufficient scenarios | 7 / 25 | 7 / 25 |
| Information-insufficient scenarios | 18 / 25 | 18 / 25 |
| Count change | — | 0 |

These are imported outputs from deterministic-rule-evaluator-v1 / information-sufficiency-v1. Both arms use an empty treatment. They are **information completeness checks**, not customer choice rates, live AI recommendations, real bookings, revenue, or a demonstrated intervention effect.

Actual customer/model choice and matching neutral live visibility remain unknown. Importing a skill instruction package does not execute AI. Automated model/search/browser/background execution is disabled or unverified. An optional server-only OpenAI Responses adapter is included but is not connected to the run workflow.

## Three-minute demo

1. **Before:** open the frozen questions and original baseline journeys.
2. **Diagnose:** inspect the information gap and its source limitations.
3. **Improve:** review source-linked proposals and pending owner confirmation.
4. **Retest:** recompute the 25 matched pairs; show 7/25 → 7/25 honestly.

## Stack

TypeScript, React, Vinext/Vite, Cloudflare Workers, native Sites D1/R2, Drizzle migrations, and an authenticated Site MCP endpoint. The existing skills-only ChoiceLoop plugin remains separate.

## Run locally

Requirements: Node.js >=22.13.0 and pnpm 11.25.0 (the package.json packageManager version).

```bash
pnpm install --frozen-lockfile
pnpm build
```

For a **new local database only**, apply the two schema migrations in order:

```bash
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_nosy_magus.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_plain_blacklash.sql
pnpm dev
```

Open http://localhost:5173/. For portable loopback development, /signin-with-chatgpt?return_to=/ uses the starter's local test identity; it is not production authentication. Do not replay migrations already applied to the same database.

Clean checkouts select the portable profile automatically. Do not copy .sites-runtime or .wrangler from the authoring container. The Bash-oriented install:ci script is not the general portable setup route.

## Tests

Build first, then run:

```bash
pnpm exec tsc --noEmit --incremental false
node --test tests/*.test.mjs
```

71 automated tests passed in the authoring environment: 38 domain, 8 integration, 8 mocked OpenAI-adapter, and 17 built Worker/API checks. They cover persistence after refresh/restart, null preservation, duplicate imports, partial failures, cancellation, approval invalidation, incompatible comparisons, archived baseline integrity, owner isolation, and same-database local MCP calls. Tests use isolated storage and make no external AI/search/booking requests. A fresh installation on another computer was not re-run during this packaging step.

## Repository map

| Path | Purpose |
|---|---|
| app/, components/ | Five-view English interface and authenticated API/MCP routes |
| lib/ | Domain rules, historical adapter, storage boundary, optional OpenAI adapter |
| data/ | Preserved inputs and contract/brain/role exports |
| exports/ | Complete workspace backup and pre-integration backup |
| db/, drizzle/ | D1 schema and migrations |
| schemas/ | Provisional import schemas; authoritative contract is also in data/integration/ |
| tests/ | Domain, integration, adapter and Worker tests |
| docs/ | Evidence/migration/setup and detailed test records |

## Hosting and credentials

Uploading this repository to GitHub does not deploy it or enable GitHub Pages. This is a server-backed application requiring Workers, D1/R2, and authentication support. The existing .openai/hosting.json project ID belongs to the existing Site; preserve it when maintaining that Site, and do not reuse it for an unrelated deployment.

Secrets are excluded. Configure any future OPENAI_API_KEY only through supported secret storage, never in source, browser code, prompts, exports, or localStorage. The live demo is public for viewing; authenticated changes remain user-scoped. Hosted MCP connection and real AI execution must be verified separately.

No new project-level software license has been selected. Existing third-party license notices are retained.

See UPLOAD_GUIDE_JA.md for GitHub upload steps, docs/INTEGRATION_AND_MIGRATION.md for dataset lineage, and docs/TEST_RESULTS.md for verification boundaries. Some historical documents describe earlier private/pending states; they are retained as history.
