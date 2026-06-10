# Spec: `grammar.md` + `versioning.md`

> **Status: Complete**

## Goal

Expand the two compiler-facing spec stubs into canonical,
self-contained specification documents: `docs/spec/grammar.md` (the
TypeScript subset, the `define*` shapes, the static analyses, the
forbidden-constructs list) and `docs/spec/versioning.md` (the
`apiVersion: 1` freeze contract). These are the documents a future
alternate-implementation team reads to build a compatible compiler —
no "see the source code" references allowed (PLAN §17.3).

## Prerequisites

- Task 3 (VitePress wiring) — content validates against the live
  `docs:build` link gate.
- Task 2 (freeze) — `versioning.md` documents the frozen contract,
  including the `STATEFUL_PRIMITIVES` lock.

## Current Behavior

Both files are Phase-0 stubs (15 and 13 lines) that say "Content
lands with the Phase 1 compiler PR." The real contract lives spread
across PLAN.md §5 (compiler), §3.3 (versioning), §4 (language
surface) and the implementation
(`packages/compiler/src/analysis/*`,
`packages/compiler/src/diagnostics.ts`).

## Desired Behavior

Two complete spec documents, written from PLAN.md + the shipped
implementation, each self-contained and link-checked by
`pnpm docs:build`.

## Requirements

### 1. `docs/spec/grammar.md` — required sections

1. **Scope sentence** — what this document normatively specifies.
2. **Source form.** A script is a single TypeScript module
   (`.chart.ts`) whose default export is exactly one of
   `defineIndicator` / `defineDrawing` / `defineAlert` /
   `defineAlertCondition` with an object-literal first argument
   carrying `name` (string literal), `apiVersion: 1` (numeric
   literal), and the kind-specific fields. Document each `define*`
   shape (mirror the option types in `packages/core/src/define/`).
3. **The TypeScript subset.** What is accepted: the expression /
   statement grammar scripts may use, `import` restricted to
   `@invinite-org/chartlang-core` (+ `/time` subpath), `const` /
   `let`, arrow functions, bounded `for` loops, ternaries, template
   literals, etc. State the rule positively (what IS allowed), then
   the exclusions list.
4. **Forbidden constructs.** The formal list per PLAN §17.3, one row
   per construct with its `CompileDiagnosticCode`:
   `while`/unbounded loops (`unbounded-loop`), recursion
   (`recursion-not-allowed`), hostile globals — `Date`, `Math.random`,
   `fetch`, `setTimeout`, `eval`, `Function`, dynamic `import`
   (`hostile-global`), stateful calls inside loops
   (`stateful-call-inside-loop`), stateful call element access
   (`stateful-call-element-access`), dynamic series indexing
   (`dynamic-series-index`), non-literal `request.security` /
   `request.lowerTf` intervals
   (`request-security-interval-not-literal`,
   `request-lower-tf-interval-not-literal`), `lower-tf-not-lower`,
   non-literal input defaults (`input-default-not-literal`),
   `unknown-input-kind`, `multiple-input-interval`,
   `requires-intervals-not-literal`, `alert-condition-not-literal`,
   `alert-condition-field-not-literal`, `missing-default-export`,
   `api-version-mismatch`, `callsite-id-conflict`. Enumerate **all**
   codes in `packages/compiler/src/diagnostics.ts:18` — the spec
   table and the union must have identical membership.
5. **Static analyses.** One subsection per analysis pass under
   `packages/compiler/src/analysis/` (structural checks, forbidden
   constructs, stateful-call-in-loop, callsite-id injection,
   extract-inputs, extract-requested-intervals,
   extract-capabilities, extract-max-lookback,
   extract-alert-conditions, validate-lower-tf-intervals): what it
   guarantees, what it rejects, in plain prose. Describe behaviour,
   never file paths.
6. **Callsite identity.** The stable-slot-id contract: every
   stateful call site gets a deterministic id derived from source
   position; ids are stable across recompiles of identical source.
7. **What is NOT specified.** Output bundle format, sourcemaps,
   minification — implementation details, explicitly out of contract.

### 2. `docs/spec/versioning.md` — required sections

1. **The `apiVersion` integer.** Every script declares
   `apiVersion: 1`; the compiler implements exactly one frozen
   language version and rejects everything else with
   `api-version-mismatch` (quote the Task-2 message wording).
2. **What `apiVersion: 1` freezes.** The four pinned surfaces:
   (a) the script-visible core API (every export of
   `@invinite-org/chartlang-core` + `/time`), (b) the
   `STATEFUL_PRIMITIVES` registry (172 entries, name-set-locked),
   (c) the manifest schema, (d) the emission wire schemas. Additive
   extensions (new optional fields, new `PlotKind`s an adapter may
   ignore) are allowed within `1.x`; renames/removals/semantic
   changes require `apiVersion: 2`.
3. **Compiler support window.** A compiler may support versions
   N..N+2 (PLAN §3.3); this compiler supports exactly {1}.
4. **Adapter / host declaration.** Adapters and hosts advertise the
   apiVersion they support; the runtime rejects mismatches with a
   clear error.
5. **Package semver vs apiVersion.** Orthogonal axes: package semver
   governs the TypeScript API of each npm package; `apiVersion`
   governs the script language. A `2.0.0` package release does not
   imply `apiVersion: 2`.
6. **The freeze snapshot.** The `v1.0.0` git tag is the canonical
   frozen snapshot of this spec; post-tag edits to `docs/spec/` are
   clarifications, never semantic changes, and any semantic change
   is an `apiVersion` bump called out in a changeset (PLAN §17.3).

### 3. Style rules (both documents)

- Self-contained: no links into `packages/` source, no "see the
  code". Linking other spec pages and PLAN-derived prose is fine.
- Normative voice ("a conforming compiler MUST reject…").
- Code examples compile against the real surface — reuse the
  pine-migration.md front-matter style (`title`, `since: "1.0"`,
  `status: "stable"`).
- Each document ends with a **Conformance checklist** — a bulleted
  list a third-party implementer can tick.

### 4. Cross-checks

- The forbidden-constructs table is verified against
  `CompileDiagnosticCode` membership — write a small assertion in the
  PR description (manual diff), not a new CI script.
- `docs/language/forbidden-constructs.md` (stub) gets a one-line
  pointer to the spec page so the two never diverge (stub stays a
  stub otherwise).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `docs/spec/grammar.md` | Rewrite | Canonical grammar spec. |
| `docs/spec/versioning.md` | Rewrite | Canonical apiVersion contract. |
| `docs/language/forbidden-constructs.md` | Modify | Pointer to the spec page. |
| `docs/.vitepress/config.ts` | Modify (only if sidebar text changes) | Keep sidebar labels accurate. |

## Gates

- `pnpm docs:build` — dead-link gate over the new content.
- `pnpm docs:check`
- `pnpm readme:check`
- `pnpm lint` (biome formats markdown where configured)

## Changeset

None — docs-only.

## Acceptance Criteria

- [ ] `grammar.md` covers all seven required sections; every
      `CompileDiagnosticCode` member appears exactly once in the
      forbidden-constructs table (manual diff recorded in the PR).
- [ ] `versioning.md` covers all six required sections including the
      `STATEFUL_PRIMITIVES` lock and the tag-as-snapshot rule.
- [ ] Zero "see the source code" references; both docs are
      self-contained.
- [ ] Both end with a conformance checklist.
- [ ] `pnpm docs:build` green.
