# Optional OpenAI adapter

Status: implemented, disabled by default, not connected or tested against OpenAI. This foreground adapter does not supply a background worker, API credentials, consumer ChatGPT observations, or callable plugin Skills.

`lib/openai-adapter.mjs` exports `getOpenAIAdapterStatus(env)`, `buildNeutralSearchRequest(input, env)` and `runNeutralSearch(input, env, options?)`. The runner receives `{query_exact, query_sha256, request_id?, signal?}`. It returns the exact request, safe raw provider output, timestamps, hashes, actual model, usage, citations, tool logs and attempt status. It never infers recommendation or choice metrics.

Before activation, configure `OPENAI_API_KEY` only through supported Sites secret storage using the OpenAI Developers key workflow. That key workflow was not available during implementation. Do not paste a key into this app, task packets, prompts, source, browser storage or exports. Set `CHOICELOOP_MODEL` explicitly to an account-accessible model supporting Responses web search, and set `CHOICELOOP_OPENAI_ENABLED=true` only after an authorized smoke-test plan. The official guide currently demonstrates `gpt-6-astra`; there is deliberately no model default. A ChatGPT subscription is not an API credential.

The authenticated server runner must persist a queued checkpoint before invoking this module, enforce frozen-plan and call/budget limits, persist the returned attempt before progressing, and expose cancellation. Retry is a manual decision: a timed-out request may still have executed and incurred cost. The adapter makes one request, no automatic retries, at most one built-in tool call, a 1,800-token output cap and a 45-second timeout. Actual account access, latency and billing remain unverified.

Neutral requests contain only the exact frozen customer question and fixed neutral tool/model settings. They omit target hints, optimizer goals, system instructions, prior response IDs, drafts and conversation history. Web search is required; successful search verification additionally requires a completed `web_search_call` with a `search` action. Missing logs remain unverified. Responses and source content are untrusted data. Render citations as links; never execute their contents. Save API observations separately from consumer ChatGPT UI observations. Controlled simulation stays blocked until the shared contract, frozen rubric and exported role instructions arrive.

Official OpenAI documentation checked 2026-10-23:

- [Web search guide](https://developers.openai.com/api/docs/guides/tools-web-search): Responses `web_search`, required tool choice, source and citation output, search logs.
- [Responses create reference](https://developers.openai.com/api/reference/python/resources/responses/methods/create): request and response fields, tool/output caps. Search indexing exposed the relevant fields; the full reference page fetch timed out. Parameter support requires an authorized end-to-end smoke test before activation.

No provider call was made during development. Mock fetch tests only verify request isolation, key exclusion and output parsing; they do not establish live inference, search or billing access.
