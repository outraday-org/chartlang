# Adapter-author proof: scaffold hardening + tutorial + LWC walkthrough

> **Status: Complete**

## Goal

Prove the third-party adapter path end-to-end — the OSS half of the
Lightweight Charts portability story (the adapter itself lives in a
consumer repo per PLAN §15; user-confirmed). Three deliverables:
(1) the `chartlang scaffold-adapter` template gains a wired, runnable
conformance test + report script instead of comment-only pointers;
(2) `docs/adapters/writing-an-adapter.md` becomes the full §17.4
tutorial; (3) `docs/adapters/reference/lightweight-charts.md` walks
the LWC port end-to-end as the worked proof.

## Prerequisites

- Task 7 — the scaffolded template and both docs reference the
  `--report` flow and `renderConformanceMarkdown`.

## Current Behavior

- `packages/cli/src/adapterTemplate/templates.ts` (230 lines) holds
  six template constants (`PACKAGE_JSON`, `TSCONFIG`, `INDEX_TS`,
  `INDEX_TEST_TS`, `README_MD`, `GITIGNORE`). The conformance suite
  is only *mentioned* in comments (line ~150) — the scaffolded
  package has no conformance dependency, no conformance test, no
  report script.
- `packages/cli/src/commands/scaffoldAdapter.ts` writes those six
  files; validated by `scaffoldAdapter.test.ts`.
- `docs/adapters/writing-an-adapter.md` is a 12-line stub.
- `docs/adapters/reference/` exists but holds no adapter pages.

## Desired Behavior

- `chartlang scaffold-adapter my-adapter` output additionally
  contains:
  - `@invinite-org/chartlang-conformance` in `devDependencies`
    (template uses a `^1.0.0`-style range, not `workspace:*` — the
    scaffold targets consumer repos).
  - `src/conformance.test.ts` — a seventh template file: imports
    `runConformanceSuite` + the scaffolded adapter, runs the suite,
    asserts `report.failed === 0`. Ships commented-`describe.skip`
    OFF (the test runs; a fresh scaffold passes because the starter
    adapter declares minimal honest capabilities — verify this holds
    and adjust the starter capability bag if any scenario fails on
    capability-honesty grounds).
  - a `"conformance:report"` script in the scaffolded `package.json`
    that runs the suite and writes `CONFORMANCE.md` +
    `conformance-report.json` via the Task-7 renderers (small inline
    `scripts/conformance-report.ts` template file — eighth template).
- `docs/adapters/writing-an-adapter.md` is the full §17.4 tutorial:
  scaffold → implement `Adapter` → declare `Capabilities` honestly →
  plumb candle events → translate `PlotEmission` / `DrawingEmission`
  → run conformance locally → publish the report. Each step with a
  compiling code snippet.
- `docs/adapters/reference/lightweight-charts.md` is the LWC
  walkthrough: mapping LWC series/primitives onto the contract
  (candles via `setData`/`update`, line plots via line series, area
  via area series, hlines via price lines, which `DrawingKind`s map
  to LWC primitives vs get declared unsupported), an honest
  `Capabilities` bag for LWC, and the conformance-report publishing
  step. Closes with: "the adapter package lives in its own repo per
  §15 — this page is the contract-side walkthrough."

## Requirements

### 1. Template additions (`templates.ts`)

Add two constants — `CONFORMANCE_TEST_TS`, `CONFORMANCE_REPORT_TS` —
and extend `PACKAGE_JSON` (devDependency + script). Keep all
templates as string constants in the existing module (no parallel
template system). The conformance test template:

```ts
import { describe, expect, it } from "vitest";
import { runConformanceSuite } from "@invinite-org/chartlang-conformance";
import adapter from "./index.js";

describe("conformance", () => {
    it("passes the full chartlang conformance suite", async () => {
        const report = await runConformanceSuite(adapter);
        expect(report.failures).toEqual([]);
        expect(report.failed).toBe(0);
    });
});
```

The report script template mirrors `scripts/run-conformance.ts`'s
write path using the public renderers (no `--check` mode — consumer
CI decides its own drift policy; mention the option in the README
template).

### 2. `scaffoldAdapter.ts` + tests

Write the two new files (now eight total). Extend
`scaffoldAdapter.test.ts`: file-list assertion gains the new paths;
content smoke-assertions for the conformance import. Update the
command's JSDoc ("writes the eight starter files…"). `help.ts` does
**not** enumerate scaffold output files today (`HELP_TEXT` lists only
`chartlang scaffold-adapter <name> [--target <dir>]`) — no help-text
edit is required.

### 3. Starter-adapter conformance sanity

Scaffold into a temp dir during this task and confirm the starter
adapter genuinely passes the suite when the test template runs
against the workspace packages. If the starter capability bag trips
capability-honesty scenarios, fix the *template's* capability bag
(declare less, honestly) — never special-case the suite.

### 4. `docs/adapters/writing-an-adapter.md` (§17.4 tutorial)

Required sections: Prerequisites → Scaffold → The `Adapter` interface
(what each method receives, referencing `docs/spec/emissions.md`) →
Declaring `Capabilities` honestly (silent no-op contract) → Candle
plumbing (close events vs ticks) → Translating emissions → Running
conformance locally → Publishing your `CONFORMANCE.md` → Publishing
to npm under your own scope (§15.2's seven-step list, prose form).
Code snippets compile against the real adapter-kit surface.

### 5. `docs/adapters/reference/lightweight-charts.md`

The §15 proof artefact. Walks the capability mapping table
(LWC feature ↔ `PlotKind`/`DrawingKind` ↔ supported or declared-out),
the event plumbing, and ends with the conformance-report step. Add
the page to the VitePress sidebar (Adapters → Reference).

### 6. Docs registration

Both pages join the sidebar in `docs/.vitepress/config.ts`;
`pnpm docs:build`'s dead-link gate covers every snippet link.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/cli/src/adapterTemplate/templates.ts` | Modify | Two new template constants + package.json template extension. |
| `packages/cli/src/commands/scaffoldAdapter.ts` | Modify | Write eight files; JSDoc update. |
| `packages/cli/src/commands/scaffoldAdapter.test.ts` | Modify | Cover new files + contents. |
| `docs/adapters/writing-an-adapter.md` | Rewrite | Full §17.4 tutorial. |
| `docs/adapters/reference/lightweight-charts.md` | Create | LWC porting walkthrough (contract proof). |
| `docs/.vitepress/config.ts` | Modify | Sidebar entries. |
| `.changeset/phase7-scaffold-conformance.md` | Create | Minor on cli. |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage on touched cli files)
- `pnpm docs:check`
- `pnpm docs:build`
- `pnpm readme:check`

## Changeset

`.changeset/phase7-scaffold-conformance.md`:

```md
---
"@invinite-org/chartlang-cli": minor
---

`chartlang scaffold-adapter` output now ships a wired conformance
test (`src/conformance.test.ts`) and a `conformance:report` script
that writes the public `CONFORMANCE.md` + `conformance-report.json`
pair — the scaffold-to-conformant-adapter path is runnable out of
the box.
```

## Acceptance Criteria

- [ ] Scaffolded package contains the conformance test + report
      script; a fresh scaffold passes the suite (verified in a temp
      dir, result recorded in the PR description).
- [ ] `writing-an-adapter.md` covers every §17.4 bullet with
      compiling snippets.
- [ ] `lightweight-charts.md` walkthrough published with the
      capability mapping table and the §15 consumer-repo closing
      note.
- [ ] Sidebar updated; `pnpm docs:build` green.
- [ ] 100% coverage on touched cli files; all gates green.
- [ ] Changeset committed.
