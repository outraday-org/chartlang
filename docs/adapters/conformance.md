# Conformance suite

> **Phase:** Lands in Phase 1.
> **Cross-reference:** See PLAN.md §15.3.

How `@invinite-org/chartlang-conformance` certifies an adapter:
fixture-driven scenarios that replay a known candle stream + script
pair, compare emissions against golden output, and publish a
machine-readable report. Passing the suite is what lets an adapter
claim a chartlang version.

Stubbed during the Phase 0 bootstrap so the docs gate has a stable
target. Content lands with the Phase 1 conformance-harness PR.
