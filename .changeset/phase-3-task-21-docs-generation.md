---
"@invinite-org/chartlang-cli": minor
---

Phase-3 Task 21 — `gen-docs` extension for `draw.*` primitives + 61
auto-generated `docs/primitives/draw/<kebab-kind>.md` pages + the
hand-written `docs/primitives/draw/index.md` index.

Adds a sibling `packages/cli/src/commands/extractDrawingPages.ts`
extractor that walks `packages/runtime/src/emit/draw/` recursively
(one level — into the 13 category subdirs), reads each per-kind
script-facing overload's JSDoc (`@anchors`, `@anchorCount`,
`@bucket`, `@since`, `@example`, stability marker), and writes one
`docs/primitives/draw/<kebab-kind>.md` per kind using the
draw-specific template (Anchors / Signature / Example / See also).
Cross-checks `@bucket` against the canonical `KIND_BUCKET` table in
`@invinite-org/chartlang-core` and rejects drift with a structured
`GenDocsError("bucket-mismatch", …)`.

`runDocsCommand` extended to invoke both extractors in sequence —
`pnpm docs:generate` now refreshes the `ta/` and `draw/` trees in a
single call. New `--draw-source` / `--draw-out` flags supplement
the existing `--source` / `--out` (which retain their Phase-2
meaning of `ta.*` aliases); explicit `--ta-source` / `--ta-out`
aliases are also accepted.

`scripts/docs-gate.ts` extended to regenerate both trees into
sibling tmp dirs and byte-diff each against the committed tree;
`docs/primitives/draw/index.md` is the only hand-written exception
(mirroring `docs/primitives/ta/index.md`).

New programmatic surface re-exported from `@invinite-org/chartlang-cli`:
`generateDrawingDocsPage`, `parseDrawingSource`, `runGenDrawingDocs`,
`DrawingDocInput`, `RunGenDrawingDocsOptions`.
