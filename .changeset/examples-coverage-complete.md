---
"@invinite-org/chartlang-examples": patch
---

Finalize full primitive coverage and flip the coverage gate to fully
enforcing.

- Close the last two uncovered primitives with `crossover-signal`
  (`ta.crossover`) and `crossunder-signal` (`ta.crossunder`) defaults in the
  `ta-pivots-utility` category. The catalogue now covers **every** primitive
  (200 doc pages, 200 covered) across 229 example entries, plus 15 language
  idioms via the separate `examples:idioms` gate.
- `pnpm examples:coverage` (`scripts/examples-coverage.ts`) now enforces
  `target ⊆ covered` exactly with **no allowlist** — `examples/coverage-allowlist.json`
  is deleted, so any future `docs/primitives/**` page without an example is a
  hard CI failure. Dropped the allowlist read and the `STALE_ALLOWLIST` branch
  (and the corresponding helper tests).
