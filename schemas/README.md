# ChoiceLoop provisional import/export schemas

These schemas document the versioned parallel-pack adapter. They are **not** the missing `choiceloop_contract.json` or `brain_spec.json`. `lib/domain.mjs` is the server-enforced validator; schemas are export/import documentation and are not a substitute for semantic checks.

- `observation.schema.json`: actual observation attempt shape derived from the supplied `choiceloop-observation-2.0` template. `not_run` is deliberately excluded from measured attempts.
- `workspace.schema.json`: persisted workspace envelope, keeping originals and nulls.
- `backup.schema.json`: exported backup wrapper.

Semantic checks additionally require exact original scenario queries and SHA-256, a frozen matching plan, separate observation modes, known provenance references, source-compatible control hashes, immutable observation keys, source-conflict approval blocks and server-authorized actors. Hashes use SHA-256 over UTF-8 strings; JSON object hashes use recursively sorted keys and compact JSON.

An observation key is `run_id|persona_id|mode|repeat_index|attempt_index|namespace`. `attempt_index` defaults to 1 and namespace defaults to production. Retries are bounded to three. A completed success cannot be duplicated into a new attempt. Duplicate identical keys and content are counted without another write; conflicting keys are quarantined.

Imports are transactional at the state update but support per-record validation: accepted rows persist and rejected originals enter quarantine. Source audits stay in evidence. Samples and `test`/`fixture` namespaces never enter measured metrics.

Backup restore is additive. It validates original observation payloads, rejects altered wrappers, preserved source edits, invented comparisons/approvals and changes to existing asset versions. Run/worker authority, limits, actor identity claims and derived comparisons are not imported. Newly restored drafts remain drafts; imported provenance is not an authenticated human approval. Unknown integration schemas require a documented migration and are rejected rather than guessed.
