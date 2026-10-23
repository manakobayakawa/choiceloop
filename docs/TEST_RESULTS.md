# Verification results · 2026-10-23

71 automated tests passed; 0 failures.

| Check | Result | Scope |
|---|---|---|
| Domain fixtures | 38 passed | Exact queries/nulls, freeze/bounds, manual jobs, partial import, cancel, approvals, holdout protection, backup integrity |
| Historical integration | 8 passed | Frozen25/raw hashes, 25 pairs, 7/25 → 7/25 Δ0, scope collisions, tamper and compatibility rejection |
| OpenAI adapter | 8 passed | Mocked isolation/search logs/secrets/errors/cancellation; no provider requests |
| Built Worker API | 17 passed | Actual isolated D1/R2, refresh/full restart, owner isolation, CSRF/idempotency, multipart files, MCP same-DB read/write, frozen25 import/comparison, forged backup rejection |
| TypeScript | Passed | Current app and server source |
| Sites production build | Passed | Vinext Worker + D1/R2/MCP manifests |

All tests use isolated local storage; zero external model/search/booking requests. Test stores are removed after the run. Existing historical results are imported data, not newly executed AI observations.

Browser QA verified the original five-view workspace, exact-question filtering, null display, source inspection, draft provenance, unavailable Run labels and comparison empty states. After the additional frozen25 bundle arrived, the final browser recheck was blocked by the browser URL security policy; no workaround was attempted. The new frozen25 frontend passed TypeScript/build, and its underlying import/persistence/comparison paths passed Worker tests. Its final visual browser recheck remains pending.

Hosted D1/R2/authentication, private deployment, canonical ChatGPT MCP plugin connection and actual model/search execution are not claimed. Private deployment/provisioning awaits the user's explicit approval. A local MCP test is not a remote ChatGPT connection.

Reproduce after building: node --test tests/*.test.mjs
