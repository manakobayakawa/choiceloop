# Source-preserving integration · contract 3.0.0

The supplied integration bundle and private plugin 0.2.0 are authoritative. Existing Site and skills-only plugin identities are unchanged. A skill is not an HTTP endpoint.

Contract migration M004 retains historical Sxxx records in a separate archive. The user chose the existing frozen 25-case MVP as the primary view. Original P001–P100 data and proposed parallel-v2 24-case plan remain separate, unchanged.

The frozen25 scenario fingerprint is 989739d2beaef932c6c555f916a2e9802fead4b62ac67c8374fd6f3ffe3ea9b2. Baseline baseline-0a5973567a2b and retest retest-621e31f46496 retain 25 original journeys each. The deterministic-rule-evaluator-v1 / information-sufficiency-v1 output is displayed as Information sufficiency: 7/25 before, 7/25 after, delta 0. Both treatment objects are empty. This is unchanged-content replay, not AI execution, customer choice, conversion or a treatment effect. The v3 rubric is not silently substituted for the historical evaluator.

Pilot5 and MVP25 share a baseline run_id but have different contents; records are scoped by experiment/source path and hash. Internal Q1/Q2/Q3 captures do not match frozen25 exact queries and have unverified neutral isolation. They remain excluded from neutral/live25 metrics. All extra raw records, portable role instructions, source hashes and original JSON are retained in data/integration/frozen25-import.json.

lib/integration-v3.mjs validates additive imports and recomputes matched comparisons from original journeys and compatible frozen metadata. attachIntegration appends the historical experiment and migration event without replacing provisional data. Existing user workspaces migrate with a revision-guarded D1 write.

POST /api/workspace actions:

- import_frozen25 with payload {bundle}: validate source records, preserve originals and hashes, reject conflicting changes, deduplicate identical imports.
- compare_information with payload {experiment_id,baseline_run_id,retest_run_id}: compute compatible matched pairs, counts, denominators, exclusions and unchanged controls. Never overwrite baseline.

Authentication, Origin, idempotency and revision checks apply server-side. D1 stores chunked user-scoped state; R2 stores originals/uploads. Generic backups cannot delete or forge archived baselines. The authenticated browser export retains all data. MCP development views withhold validation content and raw backups.

Import, persistence, evidence inspection and comparison are implemented. Local verification is separate from hosted verification. AI inference/search/browser/background execution remains unavailable or unverified. The optional OpenAI adapter is disabled. Source audits and imported role instructions do not establish model execution.

Sites canonical MCP provisioning and a private deployment await the user’s explicit approval. The separate skills-only plugin is untouched; consolidation remains unverified. No restaurant publication or reservation action is implemented. Previous provisional documentation is retained under docs/legacy/ and is not the current experiment plan.
