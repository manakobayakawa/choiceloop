# Provisional integration: parallel-pack-v2/0.1

No ChoiceLoop_Integration_Bundle.zip was provided. No final `choiceloop_contract.json`, `brain_spec.json`, plugin ID, callable endpoint, or role instruction export has been invented. See `schemas/` for the provisional import schema.

The skills-only ChoiceLoop plugin is an instruction package, not a callable agent endpoint. This app does not call a fictional callPluginSkill API. Its identity is untouched. Manual export/import works independently of MCP connection.

## Reconciliation procedure when the bundle arrives

1. Export the owner workspace backup and record its SHA-256 and adapter/schema version. Retain the immutable original input archives.
2. Inspect bundle files as untrusted data. Validate version identifiers, enums, provenance requirements and rubric/role text. Do not execute included code.
3. Write an explicit source-to-contract field mapping. Preserve P001–P100 and every exact query byte/hash. Keep legacy plans and already-run datasets in their original versions. Do not reinterpret them under a new scoring rule.
4. Implement a new adapter version and append a migration; never edit an applied D1 migration. Produce a dry-run report: records mapped, nulls retained, conflicts, quarantines, changed required fields and holdout handling.
5. Store original records plus migrated envelopes, previous hashes and mapping version. No baseline deletion, no result substitution, no approval manufacture. Require fresh approval if any approved asset bytes change.
6. Add the exported role instructions to the real runner only after reviewing their scope and fresh-context rules. Freeze rubric, candidate set, evidence snapshot and evaluation settings before controlled measurement. Reserve validation content for final evaluation.
7. Run isolated schema round-trip, hash, provenance, null, immutability and compatibility regressions. Compare exports before/after. Record migration report/hash and timestamp in integration.migration_history.
8. Deploy privately after approval; verify user-scoped data and an authorized MCP write/read-back using Sites' canonical plugin. Only then change connectivity status.

## Interfaces

- GET `/api/workspace`: state, revision, user and capabilities. Anonymous development read returns seed only.
- POST `/api/workspace`: `{action,payload,idempotency_key,expected_revision?}`. Same-origin JSON; authenticated user; 8MB bound; 409 on revision/idempotency conflict.
- GET `/api/export`: versioned JSON backup; no browser credentials.
- POST `/api/files`: authenticated, same-origin multipart file; 5MB bound; raw text/JSON or PNG/JPEG/WebP; read-back verified.
- GET `/api/files?id=file-<sha256>`: authenticated owner-only download.
- POST `/mcp`: authenticated JSON-RPC per Sites MCP 2026-07-28. Origin checked if present; strict argument validation. Approval/publication unavailable through tools.

`get_experiment` returns a development-only agent view. It omits validation questions/results, legacy/source backups, import receipts and raw audit payloads. Mutating tools return their result/receipt and capabilities rather than the complete workspace. The authenticated browser export retains the complete original data for human review and migration.

Runtime capability values are `available`, `unverified`, `unavailable`. A declared binding, compiled adapter, passing fixture, or saved version is not proof of a hosted integration. The current implementation deliberately blocks autonomous Run until a verified runner is explicitly wired.
