---
"@invinite-org/chartlang-runtime": patch
"@invinite-org/chartlang-conformance": patch
---

Hoist shared `ta.*` primitive helpers to `lib/`: relocate
`DirectionalState` + the 3 directional-state helpers from `dmi.ts`
to `lib/directionalState.ts` so `ta.adx` no longer cross-imports
into a sibling primitive's `src/` file. Relocate
`ScalarOrSeries` + `readSourceValue` from top-level `sourceValue.ts`
to `lib/sourceValue.ts` to consolidate the shared helper surface.
Widen `packages/runtime/src/ta/lib/CLAUDE.md` to document the
shared-primitive-helper carve-out alongside the Float64-only compute
cores.

Reconcile `PHASE_1_SCENARIOS` cardinality with `scripts/run-conformance.ts`
by renaming the export to `ALL_SCENARIOS` with a `@deprecated since 0.2.1`
alias retained for one release. Add iteration-parity test so script
and canonical export can never drift again.

Investigation note: found 78 scenarios in script (stale local
`dist/` build), 85 in array, gap is the script's `dist/`-first import
preference loading a stale snapshot — the runner iterates all 85
entries with no silent skip (`report.passed + report.failed ===
ALL_SCENARIOS.length`). CI is unaffected because `pnpm build` runs
before `pnpm conformance`. Resolution: option (a) — rename to
`ALL_SCENARIOS`, keep `PHASE_1_SCENARIOS` as deprecated alias.
