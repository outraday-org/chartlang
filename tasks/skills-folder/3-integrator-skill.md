# Task 3 — `chartlang-integrator` skill

> **Status: TODO**

## Goal

Add the **`chartlang-integrator`** Agent Skill — an Anthropic-format
skill that teaches a *developer* LLM how to integrate the chartlang
stack into a product. It covers all three integration paths in one
skill: **embed in your chart** (compile + host + adapter), **write a
chart adapter** (the `adapter-kit` contract), and **server-side
alerts** (the QuickJS host). Reference snippets only — no scaffold
generator.

## Prerequisites

Task 1 (the `skills/` directory + `skills/README.md` must exist).
Independent of Task 2.

## Current Behavior

- `skills/` holds only `chartlang-author`.
- A developer LLM wiring chartlang into a product must be hand-fed
  `docs/getting-started/embed-in-our-chart.md` and
  `docs/getting-started/write-your-first-adapter.md`.

## Desired Behavior

After this task:

- `skills/chartlang-integrator/SKILL.md` is a complete integration
  guide whose body routes to three references by use case.
- `skills/chartlang-integrator/references/{embed.md,adapter.md,server-alerts.md}`
  carry the working snippets, each anchored to a real in-repo example.
- `skills/README.md` (from Task 1) already names both skills — verify
  it does; if Task 1 named only the author skill, fix it here.

## Requirements

### 1. `skills/chartlang-integrator/SKILL.md`

Hand-written. **Frontmatter** (pushy description for trigger accuracy):

```yaml
---
name: chartlang-integrator
description: >-
  Integrate the chartlang stack into a product — compile `.chart.ts`
  scripts server-side, host the bundle in a Web Worker or QuickJS
  sandbox, and render emissions through a chart adapter. Use this skill
  whenever the user is wiring `@invinite-org/chartlang-compiler`,
  `-runtime`, `-host-worker`, `-host-quickjs`, or `-adapter-kit` into an
  app, building a new chart-vendor adapter, or running server-side
  alerts. NOT for writing `.chart.ts` scripts (that's chartlang-author).
---
```

**Body** — condense from `docs/getting-started/embed-in-our-chart.md`
and `docs/getting-started/write-your-first-adapter.md`. Required
sections:

1. **The three boundaries** — one diagram + one paragraph: a script
   becomes a bundle (compiler, server-side, needs node + native
   esbuild), the bundle runs in a host (Web Worker or QuickJS sandbox),
   the host's emissions render through an adapter. Two typed JSON-safe
   boundaries: runtime↔host and host↔adapter.
2. **Pick your path** — a routing table:

   | If you want to… | Read | Package(s) |
   |---|---|---|
   | Run user scripts inside an existing chart UI | `references/embed.md` | `-compiler`, `-host-worker`, `-adapter-kit` |
   | Render chartlang on a new chart vendor | `references/adapter.md` | `-adapter-kit` |
   | Fire alerts server-side with no browser | `references/server-alerts.md` | `-compiler`, `-host-quickjs` |

3. **Install lines** — the three role-specific install commands from
   the root README (script-author, adapter-author, embedder). State
   that the compiler is **node-only** (native esbuild) and must run
   server-side; the host + adapter run wherever isolation is wanted.
4. **Capability gating (cross-cutting)** — the runtime queries the
   adapter's `Capabilities` before emit; unsupported features become
   **silent no-ops**, not errors. An adapter advertises what it
   supports; the manifest declares what a script needs. Link
   `docs/spec/manifest.md`.
5. **Host parity guarantee** — the in-process runner, Worker host, and
   QuickJS host return byte-identical plot/alert streams
   (`parity-smoke.mts` demonstrates). Swapping hosts is a one-line
   change (same `ScriptHost` shape).

Target ~140–200 lines. Deep snippets live in `references/`.

### 2. `references/embed.md`

Hand-written, drawn from `docs/getting-started/embed-in-our-chart.md`.
Include the three working snippets that file already carries (keep them
in sync with it — copy current content, do not invent):

- **Compile server-side** — `compile(source, { apiVersion: 1, sourcePath })`
  with `CompileError` handling; note this runs in a node HTTP endpoint.
  Point at `examples/react-demo/server/compilePlugin.ts` as the
  reference middleware.
- **Host the bundle** — `createWorkerHost({ capabilities })` then
  `host.load({ moduleSource, manifest })`; the `host.push({ kind:
  "close", bar })` / `host.drain()` / `host.dispose()` loop. Mention the
  `host-quickjs` swap is one line (same `ScriptHost`).
- **Render through an adapter** — `createCanvas2dAdapter` +
  `runRendererLoop`, pointing at `examples/canvas2d-adapter/`.

End with a "full wiring" pointer to `examples/react-demo/` (editor +
live chart) and `examples/canvas2d-adapter/playground/` (vanilla).

### 3. `references/adapter.md`

Hand-written, drawn from `docs/getting-started/write-your-first-adapter.md`.
Cover:

- The `adapter-kit` contract: what an adapter must expose
  (`capabilities`, and the `candles` / `onEmissions` / `dispose`
  surface). Reference `examples/canvas2d-adapter/src/` as the worked
  reference (`capabilities.ts`, `createCanvas2dAdapter.ts`,
  `defaultAdapter.ts`).
- The capability surface: how an adapter advertises which plot kinds,
  drawing kinds, alert kinds, and input shapes it renders; everything
  unadvertised is a silent no-op.
- The conformance harness: `pnpm conformance` runs every adapter
  against the shared scenario battery; the canvas2d adapter ships a
  green `CONFORMANCE.md` to diff against. Point at
  `packages/conformance/` + `examples/canvas2d-adapter/CONFORMANCE.md`.
- A note that `chartlang scaffold-adapter` (the CLI) generates a
  starter adapter package — show the command, point at
  `packages/cli/` help.

### 4. `references/server-alerts.md`

Hand-written. Cover:

- Why QuickJS: process-isolated, real CPU preemption + hard heap caps,
  fires alerts when no browser is open.
- `createQuickjsHost` (or the host's actual factory — verify the export
  name in `packages/host-quickjs/src/index.ts` before writing) with
  `capabilities`, `host.load`, the bar-feed loop, draining **alerts**
  specifically.
- The sandbox boundary: the bundle is process-isolated; transferable
  cloning preserves type info; no host I/O reaches the script. Link
  `docs/hosts/` and `packages/host-quickjs/CLAUDE.md` invariants.
- Parity: the QuickJS alert stream is byte-identical to the Worker
  host's (`parity-smoke.mts`).

### 5. Verify `skills/README.md`

Confirm Task 1's `skills/README.md` names **both** skills with their
one-line purpose. If it only named `chartlang-author`, add the
`chartlang-integrator` line here.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `skills/chartlang-integrator/SKILL.md` | Create | Developer integration guide + routing. |
| `skills/chartlang-integrator/references/embed.md` | Create | Compile + host + adapter snippets. |
| `skills/chartlang-integrator/references/adapter.md` | Create | adapter-kit contract + conformance. |
| `skills/chartlang-integrator/references/server-alerts.md` | Create | QuickJS host for headless alerts. |
| `skills/README.md` | Modify (if needed) | Ensure both skills are listed. |

## Gates

- `pnpm readme:check` — unaffected (`skills/**` is not read by the
  README gate); confirm no regression anyway.
- `pnpm typecheck` / `pnpm test` / `pnpm docs:gate` — **unaffected**
  (markdown only, no package `src/` touched). Confirm none regress.
- **Snippet accuracy** — every export name / signature in the
  references (`compile`, `CompileError`, `createWorkerHost`,
  `createCanvas2dAdapter`, `runRendererLoop`, the QuickJS host factory)
  must match the current package surface. Grep each against the
  package `src/index.ts` before committing — stale snippets are the
  primary failure mode for a hand-written integration skill.

## Changeset

None. `skills/` is repo tooling/docs — no published-package version
change.

## Acceptance Criteria

- `skills/chartlang-integrator/SKILL.md` has valid `name` +
  `description` frontmatter and covers all five body sections;
  ~140–200 lines.
- All three references exist and their snippets match the current
  package exports (verified by grep, not memory).
- `references/adapter.md` points at the canvas2d reference + the
  conformance harness; `references/server-alerts.md` uses the real
  QuickJS host factory name.
- `skills/README.md` lists both skills.
- No regression in `pnpm typecheck` / `pnpm test` / `pnpm readme:check`.
- No changeset committed.
