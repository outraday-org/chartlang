# packages/examples/

`@invinite-org/chartlang-examples` — the example catalogue as a **published,
public** typed data package. Downstream repos (invinite) import it to
regenerate their chartlang template dialog from the canonical catalogue.

## Invariants

- **The package surface is GENERATED, never hand-authored.**
  `src/catalogue.generated.ts` is emitted by `pnpm examples:generate`
  (`scripts/gen-demo-scripts.ts` → `renderExamplesPackageModule`, folded into
  `scripts/gen-examples-docs.ts`) from `examples/catalogue.ts` + the on-disk
  `.chart.ts` sources. `pnpm examples:gate` byte-diffs it alongside
  `apps/site/.../scripts.ts` + `examples/catalogue.json` — so it cannot drift.
  Never hand-edit it; re-run `pnpm examples:generate`.
- **The generated module is SELF-CONTAINED.** It inlines the taxonomy
  (`ExampleCategory` / `CATEGORY_LABELS` / `CATEGORY_ORDER`), the
  `ExampleMeta` / `ExampleMetaWithSource` types, and `EXAMPLE_CATALOGUE`
  (metadata + inlined `.chart.ts` `source`, identical payload to
  `examples/catalogue.json`). It must **not** import repo-root `examples/` —
  the package builds with `rootDir: ./src` and ships in `dist`, so a
  cross-boundary import would break the build and the published artifact.
- **JSDoc lives in the generated file**, at each declaration (the
  host-quickjs `*.generated.ts` precedent), so `pnpm docs:check` passes; the
  file is Biome-ignored (`packages/examples/src/*.generated.ts` in
  `biome.json`) so `pnpm format` can't break the byte-diff. `src/index.ts`
  only re-exports it (re-exports are skipped by `docs:check`).
- **Public surface (the Task 24/25 contract):** `EXAMPLE_CATALOGUE`,
  `CATEGORY_LABELS`, `CATEGORY_ORDER`, types `ExampleCategory`, `ExampleMeta`,
  `ExampleMetaWithSource`.
- Scaffolded via `pnpm scaffold` (`packages/examples` in `PACKAGE_DIRS`) — the
  six §22.4 files are generated, not hand-written. 100% coverage gate applies
  (the data module is fully covered by importing it in `src/index.test.ts`).
- Publishing is automatic via the changesets release flow (public package).
  When that release actually publishes this package, the `release` job in
  `.github/workflows/ci.yml` fires a cross-repo `repository_dispatch`
  (`chartlang-examples-updated`) to invinite — gated on the changesets
  action's `published` / `publishedPackages` outputs, never on a bare push.
  See `.github/CLAUDE.md`.
