# ChoiceLoop — Handoff to the existing plugin

Use the attached ChoiceLoop parallel preparation files with the existing plugin. Do not create another plugin.

1. Preserve all original persona IDs and exact queries. Load 02_experiment_plan_v2.json as a proposed new experiment plan; do not overwrite or relabel any experiments already executed elsewhere. Confirm the version used by each record.
2. Treat 04_live_observations.json as empty unless genuine records are imported. Reading restaurant websites is a source audit, not a live AI recommendation experiment.
3. Do not regenerate personas or fill in absent measurements. Use verified facts from 05_evidence_registry.json, including its uncertainty/owner-confirmation flags.
4. Import completed baseline records, validate raw responses and metadata, and report rejected/incomplete records without deleting them. Preserve display position separately from explicit preference rank.
5. Analyze development scenarios only. Show three levels: observed result, source-supported difference, and causal hypothesis. Do not claim that page differences explain rankings causally.
6. Generate one practical draft addressing a supported barrier. Map factual claims to evidence IDs. Do not invent prices, availability, accessibility or dietary safety. Export only after explicit approval; do not publish.
7. For controlled testing, fix the evaluation rubric, evidence snapshot, candidate set, scenario/query, model setting and versions. Change only the target content; include unchanged control cases and vary presentation order where feasible. Assess the whole candidate set under both conditions. Keep outcome labels simulated, with concise evidence-linked reasons rather than purported hidden model reasoning.
8. Hold out validation scenarios until draft and rubric are frozen. Evaluate old and proposed content on those same validation scenarios. Report all outcomes, including no change and worse outcomes. Do not keep optimizing on the same exposed holdout and still call it held out.
9. Return structured scenario, observation, diagnosis, intervention and comparison records for the interface to import. Do not claim persistent storage or tool integration until verified in this environment.
10. Keep live retests separate. An unpublished draft cannot establish a live visibility improvement. Public changes and subsequent search differences still do not by themselves prove causality.

Before any run, state: available tools, missing integrations, active experiment plan, number of actual imported observations, and proposed next bounded action. Do not claim background execution.
