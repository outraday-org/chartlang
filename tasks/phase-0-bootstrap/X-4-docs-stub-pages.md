# Task 4 — Docs Stub Pages

> **Status: TODO**

## Goal

Write the `docs/` stub markdown pages so that every section listed in
PLAN.md §17.1's tree has a real page on disk. Stubs let
`pnpm docs:check` and the eventual `pnpm docs:build` pass on the
bootstrap without writing content prematurely, and they give the root
`README.md` (Task 5) stable link targets.

## Prerequisites

- Task 1 complete: `docs/{language, primitives, adapters, hosts,
  spec, getting-started, reference}/` directories exist.
- Task 2 complete: workspace is `pnpm install`-able.
- Task 3 complete: `pnpm docs:check` runs to completion.

## Current Behavior

Every `docs/<section>/` directory exists but contains only `.gitkeep`
files. The root `README.md` (when Task 5 writes it) cannot link to any
docs page without producing a broken-link warning under `docs:build`.

## Desired Behavior

Every page in the §17.1 tree exists as a ≤ 20-line stub with title +
phase + cross-reference + 1-paragraph description. `pnpm docs:check`
exits 0. The auto-generated areas (`docs/primitives/<area>/` and
`docs/adapters/reference/`) keep their `.gitkeep` files because Phase
1+ writes generated content into them.

## Requirements

### 1. `docs/index.md` — docs-site landing page

Mirror the root README's elevator pitch + CTAs but optimised for the
docs site. Sections:

1. Elevator pitch (1 paragraph, ≤ 80 words — same content as the
   root README).
2. Three call-to-action links: "Write your first script",
   "Write your first adapter", "Embed in a chart" — each linking to
   the matching `getting-started/` stub.
3. Architecture diagram — `mermaid` fenced block mirroring PLAN.md
   §2: `[script.chart.ts] → compiler → runtime → adapter → chart`.
4. Footer links to `language/`, `primitives/`, `adapters/`,
   `hosts/`, `spec/`, `reference/`.

Length cap: 100 lines.

### 2. Stub page template

Every stub page below uses this template (≤ 20 lines):

```markdown
# <Page title>

> **Phase:** Lands in Phase <N>.
> **Cross-reference:** See PLAN.md §<n>.

<One-paragraph description of what this page will document.>

Stubbed during the Phase 0 bootstrap so the docs gate has a stable
target. Content lands with the <which> PR in Phase <N>.
```

Length cap: 20 lines per stub. Strict — `pnpm readme:check`'s length
caps target READMEs, but doc-page sprawl defeats the purpose of stubs.

### 3. Required stub pages

Write every page in the table below. Each row's "Title" is the `#`
heading; "Phase" + "PLAN §" populate the front-matter blockquote.

| Path | Title | Phase | PLAN § |
|------|-------|-------|--------|
| `docs/getting-started/write-your-first-script.md` | Write your first script | 1 | §19 Phase 1 |
| `docs/getting-started/embed-in-our-chart.md` | Embed in your chart | 1 | §22.9 PR 11 |
| `docs/getting-started/write-your-first-adapter.md` | Write your first adapter | 1 | §17.4 |
| `docs/language/overview.md` | Language overview | 1 | §4 |
| `docs/language/series-and-indexing.md` | Series and indexing | 1 | §4.3 |
| `docs/language/inputs.md` | Inputs | 4 | §12 |
| `docs/language/alerts.md` | Alerts | 1/5 | §11 |
| `docs/language/version-pinning.md` | Version pinning | 1 | §3.3 |
| `docs/language/forbidden-constructs.md` | Forbidden constructs | 1 | §5 |
| `docs/adapters/contract.md` | Adapter contract | 1 | §7 |
| `docs/adapters/capabilities.md` | Adapter capabilities | 1 | §7.2 |
| `docs/adapters/writing-an-adapter.md` | Writing an adapter | 1 | §17.4 |
| `docs/adapters/conformance.md` | Conformance suite | 1 | §15.3 |
| `docs/hosts/worker.md` | Worker host | 1 | §8.2 |
| `docs/hosts/quickjs.md` | QuickJS host | 5 | §8.3 |
| `docs/hosts/writing-a-host.md` | Writing a host | 5+ | §8 |
| `docs/spec/grammar.md` | Grammar (TS subset) | 1 | §5 / §17.3 |
| `docs/spec/semantics.md` | Execution semantics | 1 (expanded each phase) | §6 / §17.3 |
| `docs/spec/manifest.md` | Script manifest | 1 | §4.1 / §5 |
| `docs/spec/emissions.md` | Emission payloads | 1 | §7 |
| `docs/spec/versioning.md` | apiVersion contract | 1 | §3.3 |
| `docs/reference/glossary.md` | Glossary | 1+ (cross-cuts) | (cross-cuts) |
| `docs/reference/faq.md` | FAQ | 1+ (cross-cuts) | (cross-cuts) |

### 4. Delete consumed `.gitkeep` files

Once each directory has at least one real `.md` stub, delete the
`.gitkeep` file in that directory. Keep `.gitkeep` in:

- `docs/primitives/ta/.gitkeep`
- `docs/primitives/plot/.gitkeep`
- `docs/primitives/draw/.gitkeep`
- `docs/primitives/alert/.gitkeep`
- `docs/primitives/input/.gitkeep`
- `docs/adapters/reference/.gitkeep`

These are auto-generated content areas. Phase 1's
`packages/cli/src/gen-docs.ts` (§17.2) writes one page per primitive
into `docs/primitives/<area>/`. Phase 2+ adapters in consumer repos
generate their own `docs/adapters/reference/<adapter>.md` pages.

### 5. (Optional) skip VitePress wiring

`pnpm docs:build` runs `vitepress build docs` per §22.3. Vitepress
needs `docs/.vitepress/config.ts` to build. **Do not** write a
vitepress config in this task. The Task 5 CI workflow does not call
`docs:build` — only `docs:check`. VitePress wiring lands when the
docs content is worth deploying, no earlier than Phase 1.

If a future contributor adds a `docs:build` step to CI, that PR ships
the vitepress config too.

### 6. Verify

After writing every stub:

```bash
pnpm format:check                  # markdown formatting passes
pnpm docs:check                    # exits 0
ls docs/getting-started/           # 3 .md files, no .gitkeep
ls docs/language/                  # 6 .md files, no .gitkeep
ls docs/adapters/                  # 4 .md files + reference/, no top-level .gitkeep
ls docs/hosts/                     # 3 .md files, no .gitkeep
ls docs/spec/                      # 5 .md files, no .gitkeep
ls docs/reference/                 # 2 .md files, no .gitkeep
ls docs/primitives/ta/             # only .gitkeep
ls docs/adapters/reference/        # only .gitkeep
```

### 7. What this task does NOT do

- Does **not** write the root `README.md`, `CONTRIBUTING.md`,
  `CODE_OF_CONDUCT.md`. Task 5.
- Does **not** write `.github/workflows/ci.yml` or
  `pull_request_template.md`. Task 5.
- Does **not** open the bootstrap PR. Task 5.
- Does **not** write per-primitive or per-adapter content under
  `docs/primitives/` or `docs/adapters/reference/`. Phase 1+.
- Does **not** add a vitepress config (see Requirement 5).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `docs/index.md` | Create | Docs-site landing page. |
| `docs/getting-started/{write-your-first-script,embed-in-our-chart,write-your-first-adapter}.md` | Create | Stub pages. |
| `docs/language/{overview,series-and-indexing,inputs,alerts,version-pinning,forbidden-constructs}.md` | Create | Stub pages. |
| `docs/adapters/{contract,capabilities,writing-an-adapter,conformance}.md` | Create | Stub pages. |
| `docs/hosts/{worker,quickjs,writing-a-host}.md` | Create | Stub pages. |
| `docs/spec/{grammar,semantics,manifest,emissions,versioning}.md` | Create | Stub pages. |
| `docs/reference/{glossary,faq}.md` | Create | Stub pages. |
| `docs/{getting-started,language,adapters,hosts,spec,reference}/.gitkeep` | Delete | Replaced by stub pages. |
| `docs/primitives/{ta,plot,draw,alert,input}/.gitkeep` | Keep | Auto-generated content lands in Phase 1+. |
| `docs/adapters/reference/.gitkeep` | Keep | Consumer adapters land here in Phase 2+. |

## Acceptance Criteria

- [ ] `docs/index.md` exists, ≤ 100 lines, matches the elevator
      pitch + CTA + diagram + footer structure.
- [ ] Every row in Requirement 3's table has a `.md` file at the
      listed path.
- [ ] Every stub matches the template from Requirement 2 (heading +
      phase + cross-reference + 1-paragraph description), ≤ 20 lines.
- [ ] No `.gitkeep` remains in `docs/{getting-started,language,
      adapters,hosts,spec,reference}/`.
- [ ] `.gitkeep` is preserved in every `docs/primitives/<area>/`
      and in `docs/adapters/reference/`.
- [ ] `pnpm format:check` exits 0.
- [ ] `pnpm docs:check` exits 0 (no exports added, JSDoc gate
      vacuous).
- [ ] No vitepress config written.
- [ ] No file outside `docs/` is modified.
