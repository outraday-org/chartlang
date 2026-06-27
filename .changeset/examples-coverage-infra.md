---
---

Examples coverage infrastructure (tooling + `examples/`; no published-package
version bump — `apps/site` is private and the catalogue is not yet published).

- Add `examples/catalogue.ts` — the author-facing example registry (taxonomy
  `ExampleCategory` + `CATEGORY_LABELS`/`CATEGORY_ORDER`, `ExampleMeta`) — and
  the `examples/catalogue/` fragment dir (`complex.ts` holds the 32 migrated
  entries: the 25 legacy `DEMO_SCRIPTS` + 7 e2e-only on-disk scripts).
- `apps/site/src/components/demo/scripts.ts` (`DEMO_SCRIPTS`) and
  `examples/catalogue.json` are now **generated** from the catalogue + each
  `examples/scripts/<id>.chart.ts` by `pnpm examples:generate`; `DemoScript`
  gains a `category` field. `pnpm examples:gate` byte-diffs both plus
  `docs/examples/**`.
- `packages/cli/src/e2e.test.ts` derives `EXAMPLE_SCRIPTS` from the catalogue
  (no third hand-maintained list).
- Add `scripts/examples-coverage.ts` (`pnpm examples:coverage`) — enumerates the
  canonical primitive id set from the `docs/primitives/**` page tree and fails CI
  if any page lacks an example. It landed with a transitional
  `examples/coverage-allowlist.json` that the population tasks drained; the
  finalize step removes that file so the gate is fully enforcing (see the
  companion `examples-coverage-complete` changeset).
