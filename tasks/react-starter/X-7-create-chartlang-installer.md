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
- **Not** the §22.4 six-file scaffold. It is a CLI package — follow
  `packages/cli`'s shape (tsconfig, vitest, build) but with its own
  name. **Do NOT append to `scripts/scaffold.ts` `PACKAGE_DIRS`.**
  Reason (verified against `scripts/scaffold.ts` `pkgJson`): the library
  template hardcodes a **`@invinite-org/chartlang-<name>` scoped name with
  no `bin` field** and a fixed `scripts`/`publishConfig` block.
  `create-chartlang` publishes under the **bare** name `create-chartlang`
  with a `bin` (`{ "create-chartlang": "./dist/index.js" }`), so the
  generated `package.json` would be wrong, and re-running `pnpm scaffold`
  is meant to be zero-diff. Note: `packages/cli` **is** listed in
  `PACKAGE_DIRS` (it got the six base files from the scaffold) but is then
  **hand-customized beyond the template** (`bin`, `publishConfig`, custom
  `scripts`) — mirror that customization, but hand-author `create-chartlang`
  entirely (don't add it to `PACKAGE_DIRS`) since its bare published name
  doesn't fit the scoped template. Note the deviation in the package
  `CLAUDE.md`.
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
3. **Choose library:** prompt with the 5 adapters from **`ADAPTER_REGISTRY`**
   (`packages/cli/src/generated/adapters/registry.ts` — use it, not
   `BUNDLED_ADAPTERS`, for the prompt `displayName` / `library` /
   `libraryRange` metadata; `BUNDLED_ADAPTERS` carries only `{ id, files }`).
   Echarts default, shown first; `--library <id>` skips the prompt;
   `--yes` takes the default. Validate `--library` against the registry ids.
4. **Vendor the adapter:** `BUNDLED_ADAPTERS` is a
   `ReadonlyArray<{ id: string; files: Readonly<Record<string, string>> }>`,
   so look the bundle up with **`BUNDLED_ADAPTERS.find((b) => b.id === id)`**
   (NOT `BUNDLED_ADAPTERS[id]` — it is an array, not an id-keyed map; mirror
   `addAdapter.ts`'s `findBundle`). Write `bundle.files` (a `path → contents`
   map; split keys on `/` and re-join with `path` for Windows) into
   `my-app/vendor/<id>-adapter/`. The bundle's `package.json` is **already**
   `workspace:^ → ^<published>` rewritten by the `adapters:generate`
   generator. Substitute the **`__PKG_NAME__`** placeholder (exact string,
   only present in the bundle's `package.json`) with a local name (e.g.
   `@local/<id>-adapter`) — exactly as `addAdapter.ts`'s `writeBundle` does
   (`contents.split(PKG_NAME_PLACEHOLDER).join(pkgName)`).
5. **Rewrite the seam:** rewrite `src/lib/chart/activeAdapter.ts` to
   import from the vendored adapter and call its factory (per the
   per-library contract documented in Task 5). Drop the echarts default
   import when another library is chosen.
6. **Rewrite `package.json`:** replace every `"@invinite-org/chartlang-*":
   "workspace:*"` in the **cloned starter** with the published versions,
   and drop the `chartlang-example-*-adapter: workspace:*` dep (the chosen
   adapter is now vendored locally). **Version source (offline):**
   `resolveWorkspaceVersions` is a **build-time** helper in
   `scripts/gen-adapters.ts` — it is **not** runtime-importable by the
   installer. Instead, harvest the published `@invinite-org/chartlang-*`
   versions from the **vendored bundle's own `package.json`**, whose deps
   were already rewritten to `^<published>` by `adapters:generate`; apply
   that same `name → ^version` map to the starter's `package.json`. (Any
   `@invinite-org/chartlang-*` dep the starter needs but the adapter bundle
   doesn't list must be covered by a version-manifest baked into
   `create-chartlang` at its own build time — call this out in the package
   `CLAUDE.md`.) Add the chosen chart-library dep + range from
   `ADAPTER_REGISTRY[id].libraryRange` (e.g. echarts → `"^5"`), add the
   vendored adapter as a `file:` / path dep, set the project `name`.
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
(canvas2d/uplot/LC: `<canvas>`; echarts/konva: DOM container). The
**source of truth is Task 5's `SEAM_VARIANTS`** (`apps/react-starter/
src/lib/chart/seamVariants.ts`) — the same per-id seam bodies the
starter's `adapter-matrix.spec.ts` proves actually render. `seamTemplates.ts`
mirrors those bodies as the installer's emit templates, differing **only**
by the deterministic clone-time substitutions (`workspace:*` → published
version, `chartlang-example-<id>-adapter` → the vendored local name).
A test (below) asserts that parity so the installer can never emit a seam
the matrix never rendered.

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
- **Seam parity (all 5):** the emitted `activeAdapter.ts` for each id is
  byte-identical to `SEAM_VARIANTS[id].seamSource` after the documented
  clone-time substitutions. This is what ties the installer to the
  matrix-proven seams — if Task 5 renders it, the installer emits exactly
  it, for every library, not just echarts.
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
- The emitted seam for every id is byte-identical (post-substitution) to
  the matrix-proven `SEAM_VARIANTS[id]`, so "the installer can pick it"
  and "the starter renders it" are guaranteed to be the same set of 5.
- The flow is offline except the GitHub clone + optional install.
- 100% coverage on `packages/create-chartlang`; changeset committed;
  package `CLAUDE.md` + README landed.
- Emitted tree carries no repo CI / `CLAUDE.md` / changeset files.
</content>
