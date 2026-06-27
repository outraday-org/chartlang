---
"@invinite-org/chartlang-examples": patch
---

Add the `language` example category — 15 single-concept **language idiom**
examples ("how you express X", not "which primitive exists"): series indexing
(`.current`/`[n]`/`.length`, direct `bar.close[1]`, bidirectional `ta` `offset`,
warmup NaN gaps, bounded-loop windows, `bar.point` anchors), indicator
composition (`<dep>.output`, `.withInputs`, multi-export files, cross-file
imports), pane routing, `apiVersion: 1` version pinning, and the
`defineDrawing` / `defineAlert` / `defineAlertCondition` script kinds.

These are keyed to a new `examples/idiom-manifest.json` + a dedicated
`pnpm examples:idioms` gate (orthogonal to the per-primitive
`examples:coverage` gate — they do not appear in `coverage-allowlist.json`).
`ExampleMeta` and the generated `DemoScript` gain an optional
`idioms?: ReadonlyArray<string>` field, set only on `language` entries; the
published catalogue now carries the `language` category + `idioms` (flag for
the invinite taxonomy sync). The CLI e2e compile loop is now kind-aware so the
non-indicator idiom scripts are covered.
