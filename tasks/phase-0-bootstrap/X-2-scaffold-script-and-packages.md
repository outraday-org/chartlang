# Task 2 — Scaffold Script + Per-Package Surface

> **Status: TODO**

## Goal

Implement `scripts/scaffold.ts` per PLAN.md §22.5 and run it to
generate the six template files for every package in `packages/*` and
for `examples/canvas2d-adapter`. After this task, every package has
the §22.4 file set, the placeholder export + test pass at 100%
coverage, and `pnpm install && pnpm typecheck && pnpm lint &&
pnpm test && pnpm build` all succeed across the workspace.

## Prerequisites

- Task 1 complete: workspace skeleton + root configs in place,
  `pnpm install` working.

## Current Behavior

Empty `packages/<name>/src/.gitkeep` files exist but no package
metadata. `pnpm -r typecheck` finds zero packages. The 10
package directories and `examples/canvas2d-adapter` have no
`package.json`, so pnpm does not yet recognise them as workspace
members.

## Desired Behavior

Every directory listed in §22.5's `PACKAGE_DIRS` constant has:

- `package.json` per §22.4 template (with `<NAME>`, `<DESCRIPTION>`,
  `<OWNER>` substituted).
- `tsconfig.json` per §22.4 template.
- `vitest.config.ts` per §22.4 template (the `thresholds: { lines:
  100, statements: 100, branches: 100, functions: 100 }` block is
  mandatory).
- `README.md` (≤ 100 lines) describing the package's public surface
  per §3.2.
- `src/index.ts` exporting `PACKAGE_VERSION = "0.0.0"`.
- `src/index.test.ts` with the §22.4 placeholder test.

After this task: `pnpm install` re-resolves and recognises every
workspace package; `pnpm typecheck`, `pnpm lint`, `pnpm test`, and
`pnpm build` all pass across every package.

## Requirements

### 1. Write `scripts/scaffold.ts`

Implement the script per §22.5's skeleton, expanding the elided
template-write logic to fully cover the §22.4 templates. Required
properties:

- **Shebang** — `#!/usr/bin/env tsx`.
- **Idempotent** — never overwrite a file that already exists. The
  helper `write(path, content)` from §22.5 already enforces this with
  `if (existsSync(path)) return;`.
- **Iterates** the §22.5 `PACKAGE_DIRS` constant:
  - `packages/core`
  - `packages/compiler`
  - `packages/runtime`
  - `packages/host-worker`
  - `packages/host-quickjs`
  - `packages/adapter-kit`
  - `packages/language-service`
  - `packages/editor`
  - `packages/cli`
  - `packages/conformance`
  - `examples/canvas2d-adapter`
- **Descriptions** — use the `DESCRIPTIONS` map from §22.5 verbatim.
- **Package name** —
  - `packages/<name>` → `@invinite-org/chartlang-<name>`
  - `examples/<name>` → `chartlang-example-<name>` (not under the
    `@invinite-org` scope; this package is not published to npm).
- **Logs** — `console.log` lines per §22.5 to confirm progress. (The
  Biome lint rule `noConsoleLog: warn` permits this — Biome warns but
  does not error, and a single-use scaffolding script is the canonical
  case for `console.log`. If lint upgrades to `error` later, add
  `// biome-ignore lint/suspicious/noConsoleLog: scaffold logging` on
  the call sites.)

The script writes these six files per package (templates verbatim from
§22.4, with placeholder substitution):

1. `package.json`
2. `tsconfig.json`
3. `vitest.config.ts`
4. `README.md`
5. `src/index.ts`
6. `src/index.test.ts`

Replace `src/.gitkeep` files written in Task 1 with real `index.ts` /
`index.test.ts` — i.e. when `src/index.ts` is about to be written,
delete `src/.gitkeep` if it exists in the same directory (so git
doesn't keep a useless tracked empty file). Do this in the script
itself, not as a separate manual step.

### 2. Per-package `package.json` substitutions (§22.4)

Take the §22.4 template verbatim and substitute:

- `<NAME>` → the package's short name (`core`, `compiler`, …,
  `canvas2d-adapter`).
- `<DESCRIPTION>` → the corresponding value from the §22.5
  `DESCRIPTIONS` map.
- `<OWNER>` (in `repository.url`) → `outraday-org`.

For `examples/canvas2d-adapter`, the published-to-npm assumption does
not apply:

- `name` becomes `chartlang-example-canvas2d-adapter` (no scope).
- Add `"private": true` so it cannot be accidentally published.
- Drop `publishConfig` (since it won't publish).
- Drop the `repository.directory` field entirely — the package is
  private and doesn't need registry directory metadata. (Keep the
  `repository.url` field pointed at `outraday-org/chartlang` for
  source-link purposes.)

For every published `packages/*` package, `repository.directory` is
`packages/<name>`.

### 3. Per-package `tsconfig.json`

Verbatim from §22.4 — extends `../../tsconfig.base.json`, `outDir:
./dist`, `rootDir: ./src`, includes `src/**/*`, excludes
`**/*.test.ts`, `**/*.bench.test.ts`, `**/__fixtures__/**`.

### 4. Per-package `vitest.config.ts`

Verbatim from §22.4 / §16.1 — the `thresholds: { lines: 100,
statements: 100, branches: 100, functions: 100 }` block is mandatory.
`include: ["src/**/*.ts"]`, exclude `*.test.ts`, `*.bench.test.ts`,
`__fixtures__/**`, `index.ts`, `types.ts`.

### 5. Per-package `README.md` (≤ 100 lines, §17.1 structure)

Each package README must include, in order:

1. **Title** — package name, e.g. `# @invinite-org/chartlang-core`.
2. **Stability label** — exactly one of `experimental` / `stable` /
   `frozen` on its own line at the top. Phase 0 bootstrap value:
   **`experimental`** for every package (no package has shipped real
   API yet).
3. **One-sentence purpose** — short description of what the package
   does.
4. **Install** — `pnpm add @invinite-org/chartlang-<name>` (or, for
   `canvas2d-adapter`, "Not published — copy from
   `examples/canvas2d-adapter/`").
5. **Public surface** — bulleted list of exports per §3.2's
   responsibility table (see "Per-package public-surface lines"
   below). For Phase 0 these are **planned** exports — the actual
   `src/index.ts` exports only `PACKAGE_VERSION`. Mark the bullet list
   "Planned (Phase 1+):" to make this explicit.
6. **Minimum-viable API call** — a 5–15 line code block. For the
   bootstrap, this can be a placeholder:

   ```ts
   import { PACKAGE_VERSION } from "@invinite-org/chartlang-<name>";
   console.log(PACKAGE_VERSION); // "0.0.0"
   ```

   For `examples/canvas2d-adapter`, swap the import to the unscoped
   name: `import { PACKAGE_VERSION } from "chartlang-example-canvas2d-adapter";`.
   Note in a comment that real examples land with real exports in the
   phase that ships them.
7. **Link to docs** — `docs/<section>/<name>.md` (file may not exist
   yet — Task 4 creates the section index pages; per-symbol docs are
   auto-generated in Phase 1+).
8. **License** — `MIT` (one line).

Hard length cap: 100 lines per README. Stay well under.

#### Per-package public-surface lines (from §3.2)

Use these to populate item 5 of each README. They are the verbatim
exports listed in PLAN.md §3.2's responsibility table:

| Package | Public surface |
|---|---|
| `core` | `defineIndicator`, `defineDrawing`, `defineAlert`; primitives `ta.*`, `plot`, `draw.*`, `alert`, `input.*`, `color.*`, `style.*`; types `Series<T>`, `Bar`, `Time`, `Price`. |
| `compiler` | `compile(source, opts) → CompiledScript`, `compileFile`, `compileProject`. |
| `runtime` | `createScriptRunner(compiled, ctx) → ScriptRunner`; types for `ScriptHost`, `Adapter`, `Capabilities`. |
| `host-worker` | `createWorkerHost() → ScriptHost`. |
| `host-quickjs` | `createQuickJsHost() → ScriptHost`. |
| `adapter-kit` | `defineAdapter(opts) → Adapter`; types `Adapter`, `Capabilities`, `CandleEvent`; capability builders (`capabilities.line()`, `capabilities.histogram()`, …); `validateEmission`, `decodeDrawing`; mock candle sources; base classes `PassThroughAdapter`, `BufferingAdapter`. |
| `language-service` | `getHoverDoc`, `getCompletions`, `compileToDiagnostics`, `getSignatureHelp`, `getDefinition`. |
| `editor` | `createChartlangEditor(opts)`, `<ChartlangEditor />` React component. |
| `cli` | Commands: `chartlang compile`, `chartlang lint`, `chartlang bench`, `chartlang scaffold-adapter`, `chartlang docs`. |
| `conformance` | `runConformanceSuite(adapter) → Report`. |
| `canvas2d-adapter` (example) | Reference adapter rendering to `<canvas>`. Not exported as a package surface — copy from this folder when writing your own adapter. |

### 6. Per-package `src/index.ts`

Verbatim from §22.4:

```ts
export const PACKAGE_VERSION = "0.0.0";
```

### 7. Per-package `src/index.test.ts`

Verbatim from §22.4. The test file is **excluded** from coverage
gating per §22.4's `vitest.config.ts` exclude list, and `index.ts` is
also excluded (re-export barrels). With only `PACKAGE_VERSION` in
`index.ts` and one test importing it, the per-package coverage report
is empty-but-passing — no gate breach.

### 8. MIT license header on every source file

Per the Phase 0 README "Deliverables" list. The `src/index.ts` and
`src/index.test.ts` files generated by the scaffold must carry a
short header comment naming the MIT license. Use this exact form at
the top of each `.ts` file the scaffold writes:

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
```

(Two lines, no JSDoc. JSDoc on the exported symbol itself is a
Phase 1+ concern — `docs:check` in Task 3 only enforces JSDoc on
exports whose name is something other than `PACKAGE_VERSION` so that
the bootstrap export does not trip the gate. See Task 3 for the
opt-out logic.)

### 9. Add `scaffold.ts` to lint/format scope

`scripts/scaffold.ts` is TypeScript and lives at repo root. Biome will
lint and format it automatically (see `biome.json`'s `files.ignore`
list — `dist`, `coverage`, `*.tsbuildinfo` are excluded; `scripts/` is
not). Ensure the script passes:

- `pnpm format:check`
- `pnpm lint`

You may need to mark the `console.log` lines in the script with a
Biome ignore comment as described in Requirement 1.

### 10. Run the scaffold + re-install + verify

After the script exists:

```bash
pnpm scaffold        # equivalent to: pnpm tsx scripts/scaffold.ts
pnpm install         # re-resolves workspace pkgs; lockfile updates
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

All commands must exit 0. The `pnpm-lock.yaml` diff from `pnpm install`
must be committed.

### 11. Idempotency check

After the first scaffold + commit, re-run `pnpm scaffold`. The
command must:

- Print "wrote" lines only for files that did not exist (none, on the
  second run).
- Exit 0.
- Produce **zero** changes to the working tree (`git status` clean).

This proves the scaffold is safe to re-run when a future package is
added by appending to `PACKAGE_DIRS`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `scripts/scaffold.ts` | Create | Idempotent scaffolder, §22.5. |
| `packages/<name>/package.json` (×10) | Create (via scaffold) | §22.4 template. |
| `packages/<name>/tsconfig.json` (×10) | Create (via scaffold) | §22.4 template. |
| `packages/<name>/vitest.config.ts` (×10) | Create (via scaffold) | §22.4 / §16.1 template, 100% coverage thresholds. |
| `packages/<name>/README.md` (×10) | Create (via scaffold) | §17.1 structure, public surface per §3.2. |
| `packages/<name>/src/index.ts` (×10) | Create (via scaffold) | `export const PACKAGE_VERSION = "0.0.0";` + MIT header. |
| `packages/<name>/src/index.test.ts` (×10) | Create (via scaffold) | §22.4 placeholder test + MIT header. |
| `packages/<name>/src/.gitkeep` (×10) | Delete (via scaffold) | Replaced by `index.ts`. |
| `examples/canvas2d-adapter/package.json` | Create (via scaffold) | §22.4 template + `"private": true`, no scope. |
| `examples/canvas2d-adapter/tsconfig.json` | Create (via scaffold) | §22.4 template. |
| `examples/canvas2d-adapter/vitest.config.ts` | Create (via scaffold) | §22.4 template. |
| `examples/canvas2d-adapter/README.md` | Create (via scaffold) | §17.1 structure, "reference adapter — copy from this folder". |
| `examples/canvas2d-adapter/src/index.ts` | Create (via scaffold) | Placeholder + MIT header. |
| `examples/canvas2d-adapter/src/index.test.ts` | Create (via scaffold) | Placeholder + MIT header. |
| `examples/canvas2d-adapter/src/.gitkeep` | Delete (via scaffold) | Replaced by `index.ts`. |
| `pnpm-lock.yaml` | Update | New workspace packages resolved. |

## Acceptance Criteria

- [ ] `scripts/scaffold.ts` exists, is executable via `pnpm scaffold`,
      and matches the §22.5 skeleton (idempotent, iterates
      `PACKAGE_DIRS`, uses `DESCRIPTIONS`).
- [ ] Every directory in `PACKAGE_DIRS` has all six files from §22.4
      (`package.json`, `tsconfig.json`, `vitest.config.ts`, `README.md`,
      `src/index.ts`, `src/index.test.ts`).
- [ ] Each `package.json` resolves `<NAME>`, `<DESCRIPTION>`, `<OWNER>`
      placeholders. `<OWNER>` is `outraday-org`.
- [ ] Each `vitest.config.ts` contains the 100% threshold block.
- [ ] Each `README.md` is ≤ 100 lines, has the §17.1 structure, names
      the public surface from §3.2, and carries the `experimental`
      stability label.
- [ ] Each `src/*.ts` carries the two-line MIT header from
      Requirement 8.
- [ ] `examples/canvas2d-adapter/package.json` has `"private": true`
      and no `publishConfig`.
- [ ] `pnpm install` succeeds and updates `pnpm-lock.yaml`.
- [ ] `pnpm format:check` exits 0.
- [ ] `pnpm lint` exits 0.
- [ ] `pnpm typecheck` exits 0 across all 11 packages.
- [ ] `pnpm test` exits 0 across all 11 packages and reports
      coverage (the bootstrap exports are excluded; gate passes).
- [ ] `pnpm build` exits 0; every `packages/<name>/dist/` and
      `examples/canvas2d-adapter/dist/` exists and contains
      `index.js` + `index.d.ts`.
- [ ] Re-running `pnpm scaffold` is a no-op (`git status` clean).
- [ ] No `src/.gitkeep` files remain in any scaffolded package.
- [ ] `examples/scripts/.gitkeep` still exists (untouched — Phase 1
      replaces it).
