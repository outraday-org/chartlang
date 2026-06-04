# docs/

The chartlang documentation site. Structure mirrors PLAN.md §17.1 — that
section is the source of truth for the page tree. VitePress (or similar)
will eventually build this directory into `chartlang.dev`; the build wiring
lands in Phase 1+ alongside real content.

## Conventions

- Every page in the §17.1 tree exists on disk so the future `docs:build`
  has no broken links. Stub pages are ≤ 20 lines and follow this template:

  ```markdown
  # <Page title>

  > **Phase:** Lands in Phase <N>.
  > **Cross-reference:** See PLAN.md §<n>.

  <One-paragraph description of what this page will document.>

  Stubbed during the Phase 0 bootstrap so the docs gate has a stable
  target. Content lands with the <which> PR in Phase <N>.
  ```

- `docs/index.md` is the landing page (≤ 100 lines). It carries the
  elevator pitch, three getting-started CTAs, a `mermaid` architecture
  diagram mirroring PLAN.md §2, and footer links to each subsection.

- `.gitkeep` is **preserved** in auto-generated content areas:
  - `docs/primitives/{ta,plot,draw,alert,input}/` — Phase 1's
    `packages/cli/src/gen-docs.ts` writes one page per primitive.
  - `docs/adapters/reference/` — consumer-repo adapters publish their
    own `<adapter>.md` here from Phase 2+.
  Do not hand-author files in these directories; the generator owns
  them.

- `.gitkeep` is **removed** from any directory that has at least one
  hand-authored `.md` stub. Today that covers `getting-started/`,
  `language/`, `adapters/` (top level), `hosts/`, `spec/`, and
  `reference/` — none of which had a `.gitkeep` to begin with (Task 1
  only seeded `.gitkeep` in the auto-generated leaves).

- No VitePress config (`docs/.vitepress/config.ts`) ships in Phase 0.
  It lands with the first PR that adds a `docs:build` step to CI.

## Gate interactions

- `pnpm docs:check` is a JSDoc gate on package source files
  (`packages/**/src/*.ts`). It does **not** read `docs/**` — adding or
  editing markdown here has no effect on the gate.
- `pnpm readme:check` validates the root `README.md` and per-package
  `README.md` files. It does **not** read `docs/**`.
- `pnpm format:check` (Biome) ignores markdown.

The current effect of editing files under `docs/` is purely
documentation-site content. The CI gates wake up once VitePress lands and
runs `docs:build`.

## Map

| Directory | Purpose | Stubs |
|---|---|---|
| `index.md` | Landing page. | 1 (this file) |
| `getting-started/` | Tutorials. | 3 |
| `language/` | Narrative language docs. | 6 |
| `primitives/<area>/` | Auto-generated from JSDoc. | `.gitkeep` only |
| `adapters/` | Adapter contract + author guide. | 4 |
| `adapters/reference/` | Per-adapter pages (consumer repos). | `.gitkeep` only |
| `hosts/` | Host implementations + author guide. | 3 |
| `spec/` | Canonical language spec. | 5 |
| `reference/` | Glossary + FAQ. | 2 |
