# ChoiceLoop — Parallel UI build prompt

Build the interface and data layer for ChoiceLoop while its separate ChatGPT plugin is being built. Do not create, duplicate, replace or assume access to that plugin. This task is the interface only, not autonomous agent execution.

Inputs:
- 01_original_seed_data.json: original 100 synthetic scenarios. Preserve IDs and exact query strings. Do not treat original search priority or split as the new experiment assignment.
- 02_experiment_plan_v2.json: proposed 24-case experiment plan. 12 development, 12 validation-holdout. Warn if previously measured runs use an older plan. Keep original records unchanged.
- 03_live_run_template.json: observation contract.
- 04_live_observations.json: initially empty live dataset.
- 05_evidence_registry.json: official-site observations, NOT live AI search results. Use this audited registry rather than silently trusting legacy evidence/metrics settings in the original seed.

Build five views:
1. Scenarios: show 100 synthetic scenarios with selected-MVP indicators. Development view reveals its 12 exact queries and copy buttons. Keep validation content out of improvement prompts until final validation.
2. Live Baseline: manual import/paste of raw responses and metadata; a genuine blank state. Preserve failures. Human review confirms extracted restaurant names and whether Athena is recommended. No "Run AI" button unless a real callable integration has been connected and verified. A copy-prompt button is acceptable and must say it does not execute a search.
3. Diagnosis: evidence cards for target and real named candidate competitors. Separate verified source statements, actual competitors in observations, and explanatory hypotheses. Never infer why the search model chose a restaurant from the output alone. Allow Unknown and insufficient evidence.
4. Improvements: editable draft, source IDs, unknown facts and owner-confirmation flags. Human approval can authorize export only; it does not authorize publishing, booking or changing the real website.
5. Compare: side-by-side baseline and retest datasets, with Live Search and Controlled Simulation always separate. Match IDs/query hashes/settings; mark mismatches noncomparable. No chart values until compatible records exist.

Data contract:
Use separate scenario, observation, evidence, intervention and comparison entities. An observation's mode is LIVE_AI_SEARCH, CONTROLLED_SIMULATION, BOOKING_PATH_CHECK or ILLUSTRATIVE_SAMPLE. Never aggregate these together.
Add future integration functions as adapters only: importScenarios, importObservations, importEvidence, importDrafts, importComparisons. Do not imply adapters are connected to the plugin.

Metrics:
For successful, reviewed, web-search-confirmed, fully captured live runs: text-mention rate and recommendation rate have explicit numerators/denominators. Preference rank requires explicit preference ordering; display position is a separate metric. Missing is null, not zero. Show distinct question count and repeat count. Simulated choices are not customer conversions. Live retests without publication are repeatability controls, not evidence that an unpublished draft changed public search.

Storage:
Use available persistent storage only when actually available. Always support JSON import/export and recovery. If no hosted backend exists, a self-contained local HTML app with honest localStorage limitations is acceptable. Do not request unnecessary API keys, claim production readiness or promise background runs.

Design:
Owner-facing English UI; optional Japanese explanations. Clear hierarchy, readable typography, calm restrained styling. Show SYNTHETIC SCENARIO, LIVE OBSERVATION, SOURCE AUDIT, SIMULATION and UNKNOWN as text labels, not color alone. Opening: "Don't just optimize for being found. Optimize for being chosen."

Acceptance tests:
- All 100 original scenario IDs/query strings preserved; 24 selected with 12/12 split.
- Empty live records produce Not measured, not fake improvements.
- A clearly marked synthetic test fixture checks import code but cannot affect live KPIs.
- A raw response without required metadata is stored as incomplete, excluded from validated live metrics.
- Ranked, unranked, not-mentioned, no-search and error cases are distinct.
- No arbitrary increase in scores when a draft is added. Comparison requires actual compatible evaluation records.
- Import/export round-trip preserves IDs, raw text, provenance, null values and separate modes.
- Refresh recovery and errors tested.
- Approval is explicit, limited to the chosen action and logged.
- No actual reservation submission, external messages, owner-site updates or public deployment.

Return the working local/preview artifact, tested features, missing integrations and any limitations. Save privately for review; do not publish without approval.
