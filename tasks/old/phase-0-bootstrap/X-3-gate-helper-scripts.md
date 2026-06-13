# Task 3 — Gate Helper Scripts

> **Status: TODO**

## Goal

Implement the four CI-blocking helper scripts referenced by root
`package.json` (§22.3) so that every gate Task 5's CI workflow calls
has a real, fail-on-violation implementation. On the empty bootstrap
all four exit 0 cleanly; on subsequent PRs they enforce §16, §17, and
§22.6.

The four scripts:

1. `scripts/readme-check.ts` — `pnpm readme:check` (§17.6).
2. `scripts/docs-check.ts` — `pnpm docs:check` (§17.6).
3. `scripts/run-conformance.ts` — `pnpm conformance` (§16.5).
4. `scripts/coverage-merge.ts` — `pnpm coverage:report` (§16.5).

## Prerequisites

- Task 1 complete: root configs in place, including the `package.json`
  script names this task implements.
- Task 2 complete: every workspace package has the §22.4 files, so the
  scripts have real packages to walk.

## Current Behavior

`package.json` (Task 1) declares the four script names but no
implementations exist. Calling `pnpm readme:check`, `pnpm docs:check`,
`pnpm conformance`, or `pnpm coverage:report` fails with
"file not found".

## Desired Behavior

Every script runs to completion via `pnpm tsx scripts/<name>.ts`,
exits 0 on the bootstrap, and exits non-zero with a clear diagnostic
on any violation. Each script is shape-correct for the rules it will
enforce in later phases — no "TODO" stubs.

## Requirements

### 1. `scripts/readme-check.ts` (§17.6 + §17.1)

Verifies:

1. **Every workspace package has a `README.md`.** Walk
   `packages/*` and `examples/canvas2d-adapter`. Missing README →
   fail with the path.
2. **Root `README.md` has the §17.1 required sections** (regex match,
   case-insensitive, must appear in order):
   - Elevator pitch (first paragraph, ≤ 80 words — count words after
     stripping markdown formatting; warn but don't fail at 81–100,
     fail at 101+).
   - A fenced TypeScript code block (the runnable 10-line example).
   - "Install" heading (`##` or higher).
   - "Why" heading.
   - "Quickstart" heading.
   - Architecture diagram — either a fenced ` ```mermaid ` block or a
     fenced ` ```ascii ` / ` ```text ` block. Pattern match on the
     fence info string.
   - Links section with at least one anchor each for: docs site,
     `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `LICENSE`.
3. **Per-package `README.md` has the §17.1 / Task-2 required
   sections** (regex match, order-independent):
   - Stability label line — one of `experimental`, `stable`,
     `frozen` (case-insensitive). Exactly one must appear; fail if
     zero or more than one.
   - Install instruction (line containing `pnpm add` or, for the
     `canvas2d-adapter` example, the text "Not published").
   - Public surface section (heading containing "public surface" or
     "Planned").
   - Minimum-viable API code block (a fenced ` ```ts ` block).
   - License line (`MIT`).
4. **Length caps:** root README ≤ 300 lines; each package README ≤
   100 lines. Count lines after trimming trailing blank lines.

Exit codes:
- `0` — every check passes.
- `1` — any check fails. The script must print every failure (not
  just the first one) so a contributor sees the full punch-list.

Implementation notes:
- Use Node's `fs/promises` and `path` — no extra deps.
- Walk packages by reading `pnpm-workspace.yaml` if convenient, or
  hard-code the list from Task 1 (`packages/*` glob via `node:fs`'s
  `readdir`). The list is small; either is fine.
- Print results in a stable format: `[pass]` / `[fail]` per package,
  followed by a summary line `N packages checked, M failures`.

### 2. `scripts/docs-check.ts` (§17.6 + §17.2)

Verifies, for every exported symbol in every workspace package's
`src/index.ts` and any other `src/**/*.ts`:

1. **Has a JSDoc block** (` /** … */ `) immediately preceding the
   `export` keyword (allowing intervening blank lines or other
   exports, but the immediately-preceding non-export comment must be
   JSDoc).
2. **JSDoc block contains required tags**:
   - `@since` (any value).
   - `@example` (must contain a fenced or indented code snippet —
     don't try to compile it yet; that's a Phase 1+ concern once the
     compiler exists).
   - For symbols whose name starts with `ta.`, `draw.`, or where the
     enclosing namespace is `ta` / `draw` (heuristic: any export
     under `src/ta/` or `src/draw/`): `@formula` / `@anchors` and
     `@stable` or `@experimental`. The bootstrap has zero such
     exports, so this rule is forward-looking; implement it but do
     not flag the bootstrap.
3. **Bootstrap opt-out for `PACKAGE_VERSION`.** The §22.4 placeholder
   export `PACKAGE_VERSION` is exempt — no JSDoc required. Hard-code
   this exception as a single allowlist entry:
   `EXEMPT_EXPORTS = new Set(["PACKAGE_VERSION"])`. Document the
   exemption inline as removable once Phase 1 ships real exports.

Implementation notes:
- Use the TypeScript compiler API (`typescript`) to walk each
  `index.ts` AST. TypeScript is already a root `devDependency` per
  §22.3.
- Iterate the program's source files filtered to `packages/*/src/**`
  + `examples/canvas2d-adapter/src/**`.
- For each `ExportDeclaration` / `ExportAssignment` / `VariableStatement`
  / `FunctionDeclaration` / `ClassDeclaration` / `InterfaceDeclaration`
  / `TypeAliasDeclaration` with the `export` keyword, get its leading
  JSDoc via `ts.getJSDocTags(node)` (and the raw comment range via
  `ts.getLeadingCommentRanges`).
- Skip `*.test.ts` and `__fixtures__/**`.
- Print one failure line per offending export: `<file>:<line>: <name>
  missing @since` etc.

Exit codes:
- `0` — every exported symbol passes (or is in the exempt set).
- `1` — at least one violation.

Defer for Phase 1: actually compiling `@example` blocks against the
real compiler. Add a `// TODO(phase-1): execute @example blocks via
@invinite-org/chartlang-compiler` comment near the example-check.

### 3. `scripts/run-conformance.ts` (§16.5 / §15.3)

Wraps the future `packages/conformance` runner. For Phase 0 the
package is a placeholder, so the script must:

1. Resolve `packages/conformance/dist/index.js` (or `src/index.ts` via
   tsx if dist is missing) and attempt to import a function named
   `runConformanceSuite` from it.
2. If `runConformanceSuite` does not yet exist (Phase 0 bootstrap),
   exit 0 with the message:

   ```
   conformance: no runner exported yet (Phase 1+ wires runConformanceSuite).
   conformance: 0 scenarios, 0 failures.
   ```

   The message must be machine-parseable enough for the CI log to
   confirm the gate ran; a grep for `conformance: 0 scenarios` should
   match.
3. If the runner exists, resolve `examples/canvas2d-adapter` and
   import its default-exported `Adapter` instance, call
   `runConformanceSuite(adapter)`, and exit non-zero on any scenario
   failure. Print one line per failure with the scenario id.
4. If the adapter does not export the expected default (Phase 0), use
   the same exit-0 path with the "no runner" message. The script is
   future-proof — Phase 1+ flips it into the real path simply by
   landing the exports it looks for; no edit to this script is
   required.

Exit codes:
- `0` — runner missing (bootstrap) **or** every scenario passes.
- `1` — any scenario fails.

### 4. `scripts/coverage-merge.ts` (§16.5)

Merges per-package coverage into a single root LCOV file plus a JSON
summary, so the CI step `codecov/codecov-action@v4` can read
`./coverage/lcov.info`.

1. Walk every workspace package's `coverage/lcov.info`. Concatenate
   them into `./coverage/lcov.info` at repo root. Concatenation is
   the canonical LCOV merge — Codecov accepts multiple `TN:` /
   `SF:` blocks per file.
2. If a package has no `coverage/lcov.info` (e.g. the package's
   tests were skipped), warn but do not fail — the per-package
   vitest run is the authoritative gate; this script is a reporter.
3. Walk every workspace package's `coverage/coverage-summary.json`.
   For each of the four metrics (`lines`, `statements`, `branches`,
   `functions`), sum the per-package `total` and `covered` counts
   across packages and recompute `pct = (covered / total) * 100`
   (treat `0 / 0` as `100`). Do **not** average the per-package
   percentages — that biases small packages. Emit the merged
   `./coverage/coverage-summary.json` with the recomputed totals.
   Print a one-line summary to stdout:

   ```
   coverage: lines 100.00% / statements 100.00% / branches 100.00% / functions 100.00%
   ```

4. Exit non-zero only if `./coverage/` cannot be written (filesystem
   error). The numeric gating already happened per-package via
   vitest's `thresholds` block — this script is reporting, not
   gating.

Implementation notes:
- The `@vitest/coverage-v8` reporter writes
  `coverage/coverage-summary.json` and `coverage/lcov.info` per
  package when the per-package `vitest.config.ts` lists `"json-summary"`
  and `"lcov"` in `reporter` — which it does per §22.4 / §16.1.
- Use `node:fs/promises`. No extra deps.
- Create `./coverage/` if missing.

### 5. Shebang + lint + format

All four scripts:

- Start with `#!/usr/bin/env tsx`.
- Pass `pnpm format:check` and `pnpm lint`.
- Carry the MIT header from Task 2 Requirement 8.
- Use `console.log` / `console.error` for output. The Biome rule
  `noConsoleLog: warn` permits this; add the inline ignore comment
  if Biome warnings later upgrade to errors.

### 6. Wire each script's invocation through `pnpm`

The root `package.json` from Task 1 already declares:

```json
"conformance": "pnpm tsx scripts/run-conformance.ts",
"docs:check": "pnpm tsx scripts/docs-check.ts",
"readme:check": "pnpm tsx scripts/readme-check.ts",
"coverage:report": "pnpm tsx scripts/coverage-merge.ts"
```

Verify each `pnpm <script>` runs the corresponding file. If a script
name needs renaming for clarity, **update `package.json` to match the
file name** — do not rename the file to match `package.json`
arbitrarily. The names above are §22.3 verbatim, so this should be a
no-op.

### 7. Verify on the bootstrap

After all four scripts exist:

```bash
pnpm test                       # writes per-package coverage
pnpm coverage:report            # merges → ./coverage/
pnpm conformance                # prints "0 scenarios"
pnpm docs:check                 # passes (only PACKAGE_VERSION exported)
pnpm readme:check               # passes (every README has the required shape — once Task 5 lands the root README; in this task verify only per-package READMEs)
```

**Important sequencing caveat:** `pnpm readme:check` will fail on the
root `README.md` until Task 5 writes it. For Task 3's acceptance,
verify `readme-check.ts` works on a hand-rolled root README stub OR
defer the root-README portion of acceptance to Task 5. Recommended:
during Task 3, write a one-line `README.md` at repo root with only
`# chartlang` content and confirm `readme-check.ts` fails with a
clear list of missing sections; this proves the gate has teeth. Task
5 then replaces this stub with the real README and the gate flips
green.

### 8. What this task does NOT do

- Does **not** wire the scripts into CI — that is Task 5.
- Does **not** write root or per-package README content — Task 2
  ships per-package READMEs; Task 5 ships the root README.
- Does **not** implement `pnpm bench:ci`. Bench is `vitest bench
  --run` directly (§22.3); no helper script is needed. Vitest exits 0
  when no `*.bench.test.ts` exists, which is the bootstrap state.
- Does **not** implement `pnpm docs:build`. That is `vitepress build
  docs` directly per §22.3. Phase 0 ships no vitepress config beyond
  the stub markdown pages Task 4 writes; the bootstrap may skip
  `docs:build` in CI by guarding the step (Task 5 makes that CI
  decision; §22.6 verbatim does not call `docs:build`).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `scripts/readme-check.ts` | Create | §17.6 + §17.1 readme gate. |
| `scripts/docs-check.ts` | Create | §17.6 + §17.2 JSDoc gate. |
| `scripts/run-conformance.ts` | Create | §16.5 / §15.3 conformance harness. |
| `scripts/coverage-merge.ts` | Create | §16.5 coverage report. |
| `coverage/` | Create on first run | Output dir for merged report. |

## Acceptance Criteria

- [ ] All four files exist at `scripts/` with the `#!/usr/bin/env tsx`
      shebang and the two-line MIT header.
- [ ] All four pass `pnpm format:check` and `pnpm lint`.
- [ ] `pnpm readme:check` exits 0 against the bootstrap's per-package
      READMEs. (Root README gate is verified once in Task 3 against a
      stub-and-fail check, then flipped green by Task 5.)
- [ ] `pnpm docs:check` exits 0 against the bootstrap — only
      `PACKAGE_VERSION` is exported, and it is in the exempt set.
- [ ] `pnpm docs:check` **fails** when a contributor adds a new
      `export const foo = 1` to a `src/index.ts` without JSDoc.
      Demonstrate by temporarily adding such an export, running the
      gate to see it fail, and reverting.
- [ ] `pnpm conformance` exits 0 with the message
      `conformance: 0 scenarios, 0 failures.`.
- [ ] `pnpm coverage:report` runs after `pnpm test`, writes
      `./coverage/lcov.info` and `./coverage/coverage-summary.json`,
      and prints the four-metric summary line.
- [ ] No script overlaps work — `readme-check` does not validate
      JSDoc, `docs-check` does not validate README structure,
      `coverage-merge` does not run tests, `run-conformance` does not
      run unit tests.
- [ ] Each script prints **all** failures, not just the first, so a
      contributor sees the full punch-list per run.
- [ ] No file in `packages/` or `examples/` is modified by this task
      (scripts are repo-root tooling).
