---
"@invinite-org/chartlang-pine-converter": patch
"@invinite-org/chartlang-conformance": patch
---

Add the Pine → chartlang end-to-end test suite: a 20-fixture Pine v6 corpus with
byte-exact `.expected.chart.ts` + diagnostics goldens (generated from real
`convert()` runs, regen via `UPDATE_FIXTURES=1`), determinism + strict-mode
golden tests, and three conformance round-trip scenarios
(`pine-converter-round-trip-camp-a`/`-camp-b`/`-table`) that ingest a Pine
fixture, run `convert()`, compile the output through the chartlang compiler, run
it through the runtime, and pin the full drawing-emission stream as a
`drawing-hash`.
