# `create-chartlang` installer package

> **Status: TODO**

## Goal

Build `packages/create-chartlang/` (published as `create-chartlang`) so
`npm create chartlang@latest my-app` scaffolds a ready-to-run copy of
`apps/react-starter`: clone the starter from GitHub via `giget`, prompt
for a chart library (default **echarts**), **vendor the chosen adapter**
into the project using the CLI's offline `add-adapter` bundles, rewrite
the single `activeAdapter` seam + `package.json` workspace deps, and
write a `.env`. This is the "npx install script that clones this
project" from the brief.

## Prerequisites

- Task 6 (the full `apps/react-starter` exists and runs).
- Assumes multi-library-adapters Task 14:
  `packages/cli/src/generated/adapters/**` (`BUNDLED_ADAPTERS`, offline,
  workspace-dep-rewritten adapter bundles) exists.

## Current Behavior

No installer. Users would have to clone the monorepo and run the app
in-place; its `workspace:*` deps don't resolve standalone.

## Desired Behavior

`npm create chartlang@latest my-app` (or `pnpm create chartlang`,
`npx create-chartlang my-app`) produces a standalone, installable project
in `./my-app` with the chosen adapter wired in, no `workspace:` deps, and
a `.env` ready for an EODData key.

## Requirements

### 1. Package shape — `packages/create-chartlang/`

- Published name `create-chartlang`, public, MIT, `bin`:
  `{ "create-chartlang": "./dist/index.js" }`. This is the npm
  convention that makes `npm create chartlang` work.
- **Not** the §22.4 six-file scaffold (that template is for
  `@invinite-org/chartlang-*` libraries). It is a CLI package — follow
  `packages/cli`'s shape (tsconfig, vitest, build) but with its own
  name. **Do NOT append to `scripts/scaffold.ts` `PACKAGE_DIRS`** — that
  generator only emits the §22.4 six-file *library* template (verified:
  every `PACKAGE_DIRS` entry uses it, and `packages/cli` is hand-authored
  *outside* it). Hand-author the config to match `packages/cli` and note
  the deviation in the package `CLAUDE.md`.
- Runtime deps: `giget` (folder clone from GitHub), and reuse the CLI's
  generated adapter bundles. Prompts via `node:readline/promises` (zero
  extra prompt dep) or a tiny prompt lib if justified — prefer
  `node:readline/promises` for parity with `add-adapter`.

### 2. Flow — `src/index.ts`

`create-chartlang [dir] [--library <id>] [--pm <npm|pnpm|yarn|bun>] [--no-install] [--yes]`

1. **Resolve target dir** (arg or prompt; default `./chartlang-starter`);
   refuse a non-empty dir unless `--yes`/`--force`.
2. **Clone the starter:** `giget` the `apps/react-starter` subdir from
   `github:outraday-org/chartlang/apps/react-starter` (pin to a tag/ref
   matching the installer version). Strip repo-internal artefacts that
   shouldn't ship to the user: any `CLAUDE.md`, the `tests/` Playwright
   suite (optional — keep a lightweight smoke?), and ensure no
   `.changeset`/CI files come along (there are none in `apps/*`, but
   assert).
3. **Choose library:** prompt with the 5 ids from `BUNDLED_ADAPTERS`
   (echarts default, shown first); `--library` skips the prompt;
   `--yes` takes the default.
4. **Vendor the adapter:** write the chosen adapter's
   `BUNDLED_ADAPTERS[id].files` into `my-app/vendor/<id>-adapter/`
   (already workspace-dep-rewritten to published versions by Task 14's
   generator). Substitute the `__PKG_NAME__` placeholder with a local
   name (e.g. `@local/<id>-adapter`).
5. **Rewrite the seam:** rewrite `src/lib/chart/activeAdapter.ts` to
   import from the vendored adapter and call its factory (per the
   per-library contract documented in Task 5). Drop the echarts default
   import when another library is chosen.
6. **Rewrite `package.json`:** replace every `"@invinite-org/chartlang-*":
   "workspace:*"` and the `chartlang-example-*-adapter: workspace:*` dep
   with the published versions (read from the bundle's
   `resolveWorkspaceVersions` output / Task 14's rewritten bundle), add
   the chosen chart-library dep + range from the registry, add the
   vendored adapter as a `file:` or path dep, set the project `name`.
7. **Write `.env`:** copy `.env.example` → `.env` with
   `DATABASE_URL=file:./data/starter.db` and an empty `EODDATA_API_KEY=`
   plus a comment linking the free-tier signup.
8. **Install (optional):** run the detected/`--pm` install unless
   `--no-install`.
9. **Print next steps:** `cd my-app`, add the EODData key, `pnpm db:migrate`
   (or note it auto-runs), `pnpm dev`, and how to switch libraries later
   (`npx @invinite-org/chartlang-cli add-adapter <id>` + edit the seam).

Zero network beyond the `giget` clone + the optional install; the
adapter bundle is baked into the published installer (it bundles the
CLI's generated `BUNDLED_ADAPTERS`, or re-exports them — pick one and
document; avoid a runtime dep on the unpublished examples).

### 3. Library → seam rewrite table

Encode, per id, the import + factory-call template the seam needs
(canvas2d/uplot/LC: `<canvas>`; echarts/konva: DOM container). Source of
truth is Task 5's `activeAdapter` contract; mirror it here as string
templates so the rewrite is deterministic + testable.

### Edge cases

- **Non-empty target dir** → refuse unless `--yes`; never overwrite
  silently.
- **Unknown `--library`** → error listing valid ids; exit 1.
- **Offline** → clone needs network (normal for `create-*`); fail with a
  clear message. Adapter vendoring + seam rewrite are offline.
- **Windows paths** → normalise bundle `files` keys to `/` then re-join
  with `path` on write (same as `add-adapter`).
- **Version skew** → the installer pins the starter clone ref + uses the
  bundle's published versions so a given `create-chartlang` release
  produces a self-consistent project.
- **`workspace:` leak** → assert the emitted `package.json` contains no
  `workspace:` after rewrite (a test).

### Tests (co-located, 100% coverage)

`src/index.test.ts` — with a mocked `giget` (writes a fixture starter
tree) + the real `BUNDLED_ADAPTERS`:

- For each of the 5 ids: scaffold into a temp dir; assert the vendored
  adapter files exist, the seam imports the chosen adapter, the chart
  factory call matches the library's contract, `package.json` has **no**
  `workspace:` deps and includes the chart-lib dep, `.env` written.
- Default (no `--library`, `--yes`) → echarts.
- Unknown library → error + exit 1.
- Non-empty dir refusal + `--yes` override.
- `--no-install` skips install; pm detection branches.
- No `CLAUDE.md`/CI/`.changeset` in the emitted tree.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/create-chartlang/package.json` | Create | `create-chartlang` bin package |
| `packages/create-chartlang/src/index.ts` (+test) | Create | the installer flow |
| `packages/create-chartlang/src/seamTemplates.ts` (+test) | Create | per-library seam rewrite templates |
| `packages/create-chartlang/src/rewritePackageJson.ts` (+test) | Create | workspace-dep rewrite |
| `packages/create-chartlang/CLAUDE.md` | Create | installer invariants; relation to `add-adapter` |
| `packages/create-chartlang/README.md` | Create | ≤100-line usage |
| `packages/create-chartlang/{tsconfig.json,vitest.config.ts}` | Create | hand-authored config mirroring `packages/cli` (NOT scaffold-generated) |

## Gates

- `pnpm typecheck` / `pnpm lint`
- `pnpm test` (create-chartlang 100% coverage)
- `pnpm readme:check` (package README ≤100 lines)
- `pnpm docs:check` (JSDoc on exported symbols)

## Changeset

`.changeset/create-chartlang-init.md` — **minor** (new public package
`create-chartlang`). If Task 14's bundle export shape is touched, note
the `@invinite-org/chartlang-cli` bump too.

## Acceptance Criteria

- `npm create chartlang@latest my-app` produces a standalone, runnable
  project for any of the 5 libraries (default echarts), with the adapter
  vendored, the seam rewritten, no `workspace:` deps, and a `.env`.
- The flow is offline except the GitHub clone + optional install.
- 100% coverage on `packages/create-chartlang`; changeset committed;
  package `CLAUDE.md` + README landed.
- Emitted tree carries no repo CI / `CLAUDE.md` / changeset files.
</content>
