# Task 4 — Embedded demo + `/api/compile` server route

> **Status: TODO**

## Goal

Port the live editor + chart playground from `examples/react-demo/`
into `apps/site/` so it renders **inline below the Quickstart
section** on the home route (anchor `id="demo"`), and turn the
existing Vite dev-middleware `/api/compile` into a **TanStack Start
server route** that ships as a **Netlify Function** in production.
The end-state is `chartlang.invinite.com` showing a complete
edit→compile→render loop on Netlify, with no localhost dependency.

## Prerequisites

- Tasks 1–3 complete — site scaffold, brand system, three marketing
  sections live.

## Current Behavior

- `examples/react-demo/src/{EditorPane,ChartPane,hybridLanguageService,scripts}.tsx`
  hold the editor + chart logic.
- `examples/react-demo/server/compilePlugin.ts` exposes
  `POST /api/compile` only inside the Vite dev server — it never
  ships to production.
- `examples/react-demo/src/{esbuildStub,nodeBuiltinStub}.ts` keep the
  browser bundle importable by stubbing Node-only entry points the
  language service touches.
- `examples/react-demo/public/bars.json` is a 1000-bar deterministic
  fixture the chart preview reads.
- `apps/site/` has no demo surface; its home route ends with the
  Quickstart section.

## Desired Behavior

After this task:

- `apps/site/app/components/demo/EmbeddedDemo.tsx` mounts the editor
  and chart panes inside a section with `id="demo"` on the home
  route.
- `apps/site/app/routes/api/compile.ts` is a TanStack Start server
  route that runs the real chartlang compiler in Node and returns
  the same JSON shape today's `compilePlugin.ts` returns:
  `{ ok: true, moduleSource, manifest, diagnostics }` or
  `{ ok: false, diagnostics }`.
- The compile route deploys to Netlify as a function. Server-only
  imports (`@invinite-org/chartlang-compiler`,
  `@invinite-org/chartlang-language-service`, `node:*`) are tree-
  shaken out of the browser bundle by TanStack Start's server-route
  split.
- The browser bundle keeps the existing `esbuild` + `node:*` alias
  stubs so the local language service stays importable.
- `pnpm site:dev` runs the whole loop locally — typing in the
  CodeMirror editor triggers a `/api/compile` POST and rerenders the
  chart.
- A Playwright smoke test covers the end-to-end loop.

## Requirements

### 1. Port the demo components verbatim

Copy these files **unchanged** from `examples/react-demo/src/` to
`apps/site/app/components/demo/`:

| Source | Destination |
|---|---|
| `EditorPane.tsx` | `apps/site/app/components/demo/EditorPane.tsx` |
| `ChartPane.tsx` | `apps/site/app/components/demo/ChartPane.tsx` |
| `hybridLanguageService.ts` | `apps/site/app/components/demo/hybridLanguageService.ts` |
| `scripts.ts` | `apps/site/app/components/demo/scripts.ts` |
| `esbuildStub.ts` | `apps/site/app/lib/browser-stubs/esbuildStub.ts` |
| `nodeBuiltinStub.ts` | `apps/site/app/lib/browser-stubs/nodeBuiltinStub.ts` |

Verbatim means: do not edit the logic; preserve every JSDoc and
copyright header. Update only imports that move (e.g. relative paths
between the four `demo/` components stay relative; the browser-stubs
move to `~/lib/browser-stubs/`).

Move the bar fixture:

| Source | Destination |
|---|---|
| `examples/react-demo/public/bars.json` | `apps/site/public/bars.json` |

Both copies coexist until Task 7 deletes `examples/react-demo/`.

### 2. Wire workspace deps in `apps/site/package.json`

Add the same workspace + CodeMirror packages `examples/react-demo`
depends on:

```json
{
    "dependencies": {
        "@codemirror/lang-javascript": "^6",
        "@codemirror/lint": "^6",
        "@codemirror/state": "^6",
        "@codemirror/view": "^6",
        "@invinite-org/chartlang-adapter-kit": "workspace:*",
        "@invinite-org/chartlang-core": "workspace:*",
        "@invinite-org/chartlang-editor": "workspace:*",
        "@invinite-org/chartlang-language-service": "workspace:*",
        "chartlang-example-canvas2d-adapter": "workspace:*",
        "codemirror": "^6"
    },
    "devDependencies": {
        "@invinite-org/chartlang-compiler": "workspace:*"
    }
}
```

The compiler stays a **devDependency** of `apps/site` for the same
reason it is in `react-demo`: the production browser bundle must not
include the Node-only compiler. The server route bundles it via
TanStack Start's server graph, which is a separate dependency
resolution path.

### 3. Vite config: replicate the two browser-side aliases

In `apps/site/app.config.ts` (TanStack Start's config file — current
versions use `vite.config.ts` with a Start plugin; use whatever the
scaffold emits, see README → "TanStack Start / shadcn snippet caveat"),
pass through to Vite's `resolve.alias` exactly the two **production-
relevant** entries from `examples/react-demo/vite.config.ts`. The
react-demo also has a third alias (`chartlang-example-canvas2d-adapter`
→ its TypeScript source) that exists purely for adapter-edit HMR
during local dev. **We intentionally drop that third alias**:
`apps/site/` consumes the canvas2d adapter via its `workspace:*` dep,
which resolves to the adapter's built `dist/`. That keeps the
production Netlify bundle identical to what consumers get and
sidesteps a Vite-source-graph cost we don't need. Contributors who
want adapter HMR while iterating can still run
`cd examples/react-demo && pnpm dev` until Task 7 removes it.

```ts
// apps/site/app.config.ts (excerpt) — see caveat above
import { fileURLToPath } from "node:url";
import { defineConfig } from "@tanstack/start/config";

const ESBUILD_BROWSER_STUB = fileURLToPath(
    new URL("./app/lib/browser-stubs/esbuildStub.ts", import.meta.url),
);
const NODE_BUILTIN_STUB = fileURLToPath(
    new URL("./app/lib/browser-stubs/nodeBuiltinStub.ts", import.meta.url),
);

export default defineConfig({
    vite: {
        resolve: {
            alias: [
                // Same justification as examples/react-demo/vite.config.ts —
                // the language service is importable in the browser bundle
                // but its esbuild + node:* call paths must never execute.
                { find: "esbuild", replacement: ESBUILD_BROWSER_STUB },
                {
                    find: /^node:(crypto|fs\/promises|path|url|os)$/,
                    replacement: NODE_BUILTIN_STUB,
                },
            ],
        },
        optimizeDeps: { exclude: ["esbuild"] },
    },
    server: {
        preset: "netlify",
    },
});
```

The `server.preset: "netlify"` line is what makes
`pnpm site:build` produce a Netlify-compatible artifact (a
`.netlify/functions-internal/` tree). Confirm against the TanStack
Start docs as installed by Task 1 — the preset string is stable
across releases.

### 4. Server route — `/api/compile`

Create `apps/site/app/routes/api/compile.ts`. The `createServerFileRoute`
import below is illustrative; use the scaffold's actual server-route
factory (current TanStack Start exports it from `@tanstack/react-start/server`).

```ts
// apps/site/app/routes/api/compile.ts
import { createServerFileRoute } from "@tanstack/start/server"; // see caveat
import { handleCompile } from "~/lib/server/compile";

export const ServerRoute = createServerFileRoute("/api/compile").methods({
    POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as unknown;
        const source =
            body && typeof body === "object" && typeof (body as { source?: unknown }).source === "string"
                ? (body as { source: string }).source
                : null;
        if (source === null) {
            return Response.json(
                { ok: false, error: "Request body must be JSON: { source: string }" },
                { status: 400 },
            );
        }
        try {
            const result = await handleCompile(source);
            return Response.json(result);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return Response.json({ ok: false, error: message }, { status: 500 });
        }
    },
});
```

Create `apps/site/app/lib/server/compile.ts`. Copy the
`handleCompile(source)` body verbatim from
`examples/react-demo/server/compilePlugin.ts`. Do not re-implement —
the function is small and battle-tested:

```ts
// apps/site/app/lib/server/compile.ts
import { CompileError, compile } from "@invinite-org/chartlang-compiler";
import { createLanguageService } from "@invinite-org/chartlang-language-service";

export type CompileSuccess = Readonly<{
    ok: true;
    moduleSource: string;
    manifest: unknown;
    diagnostics: ReadonlyArray<unknown>;
}>;
export type CompileFailure = Readonly<{
    ok: false;
    diagnostics: ReadonlyArray<unknown>;
}>;

const SOURCE_PATH = "demo.chart.ts";

export async function handleCompile(
    source: string,
): Promise<CompileSuccess | CompileFailure> {
    const languageService = createLanguageService();
    const diagnostics = await languageService.compileToDiagnostics(source);
    try {
        const compiled = await compile(source, {
            apiVersion: 1,
            sourcePath: SOURCE_PATH,
        });
        return {
            ok: true,
            moduleSource: compiled.moduleSource,
            manifest: compiled.manifest,
            diagnostics,
        };
    } catch (err) {
        if (err instanceof CompileError) {
            return { ok: false, diagnostics };
        }
        throw err;
    }
}
```

Naming: the route file is `routes/api/compile.ts`, the helper is
`lib/server/compile.ts`. The `~/lib/server/` prefix is a convention
for "server-only" code; the TanStack Start bundler keeps it out of
the browser graph by virtue of the route file being its only
importer. Do **not** import `~/lib/server/*` from any component
under `app/components/`.

### 5. Bundle the compiler's `esbuild` dependency for Netlify

The compiler's `bundle.ts` does `import * as esbuild from "esbuild"`.
esbuild ships a native binary per platform. Netlify Functions on
AWS Lambda need the `linux-x64` binary. Two paths:

**Preferred** — declare `esbuild` as an external in the Netlify
function bundle so the Lambda runtime loads it from
`node_modules/`:

```toml
# netlify/site.toml (drafted in Task 5, included here for reference)
[functions]
external_node_modules = ["esbuild"]
```

**Fallback** — pin `esbuild-wasm` and switch the compiler to
detect-or-prefer it. Out of scope here; document in the PR if the
preferred path fails.

Verify by running `netlify dev` (the Netlify CLI emulator) locally
or by deploying to a preview environment from Task 6.

### 6. `EmbeddedDemo.tsx`

Compose the three demo components into one wrapper:

```tsx
// apps/site/app/components/demo/EmbeddedDemo.tsx
import { type ReactElement, useEffect, useState } from "react";
import { ChartPane } from "./ChartPane";
import { EditorPane } from "./EditorPane";
import {
    type CompileStatus,
    type CompiledArtifact,
    createHybridLanguageService,
} from "./hybridLanguageService";
import { DEMO_SCRIPTS } from "./scripts";

export function EmbeddedDemo(): ReactElement {
    // Mirror examples/react-demo/src/App.tsx but trimmed:
    //  - drop the standalone status bar; integrate into the chart pane header
    //  - keep the script switcher
    //  - cap the alerts feed at 6 rows (existing MAX_ALERTS_SHOWN)
    //  - height: lock the pane to ~640px so the chart fits between the
    //    Quickstart and the footer without dominating the page
    // …implementation…
}
```

Render structure:

- Section header — `h2` "See it in action" with a one-sentence
  subhead.
- A toolbar with the script switcher (uses `DEMO_SCRIPTS` from the
  port).
- Two-column layout — editor left (`min-h-[640px]`), chart right
  (`min-h-[640px]`).
- A small status footer showing the compile status and the last
  alert.
- Anchor: the wrapping `<section>` carries `id="demo"`.

### 7. Mount on the home route

Update `apps/site/app/routes/index.tsx`:

```tsx
import { EmbeddedDemo } from "~/components/demo/EmbeddedDemo";

function HomeRoute() {
    return (
        <>
            <Hero />
            <Features />
            <Quickstart />
            <EmbeddedDemo />
        </>
    );
}
```

### 8. Playwright smoke test (e2e)

Add `apps/site/tests/e2e/landing.spec.ts`. The site does not run
vitest, but a thin Playwright suite is the right gate for the
edit→compile→render loop. Install Playwright:

```json
{
    "devDependencies": {
        "@playwright/test": "^1.45.0"
    },
    "scripts": {
        "e2e": "playwright test",
        "e2e:install": "playwright install --with-deps chromium"
    }
}
```

The test:

1. `pnpm site:build && pnpm tsx scripts/serve-site.ts` — or rely on
   `playwright.config.ts`'s `webServer` block to run the
   already-built preview.
2. Visit `/`.
3. Assert the Hero, Features, Quickstart, and Demo sections render.
4. Find the editor textarea (CodeMirror's contenteditable), type a
   trivial change (`// noop`), wait for the compile-status badge to
   reach `ok`, assert the chart canvas re-rendered (snapshot the
   `<canvas>`'s `toDataURL` or simply assert a non-empty bitmap).

Keep the test small. Goal: prove the live loop works on the built
artifact — not a full UI regression suite.

### 9. CI participation

Wire the e2e suite into CI in Task 6. Task 4 only ships the test;
Task 6 adds the job step. The Task 4 PR runs the e2e suite locally
and includes a screenshot or GIF in the PR description.

### 10. Lazy-load Shiki & CodeMirror

Both libraries are heavy. Wrap `CodeBlock` (Task 3) and the demo
panes in `React.lazy(() => import(...))` with a small loading
placeholder so the initial bundle for `/` stays lean. If `pnpm
site:build` reports the route's JS bundle exceeds **300 KB
gzipped**, this lazy-load is mandatory; otherwise it is strongly
recommended.

### 11. Browser-only guards

`hybridLanguageService.ts` calls `fetch("/api/compile", …)`. During
SSR (TanStack Start renders the page on the server), `fetch` works
but the compile flow should be deferred to the client — wrap the
`EmbeddedDemo` mount in `useEffect` and render a static loading
state on the server. This keeps the function quota low and the
initial HTML cacheable.

### 12. Keep `examples/react-demo/` working

Do **not** delete `examples/react-demo/` in this task. The old
playground stays operational so a contributor can `cd
examples/react-demo && pnpm dev` while Tasks 5–6 finalise the
Netlify deploy. Task 7 deletes it.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/site/app/components/demo/EditorPane.tsx` | Create (port verbatim) | CodeMirror + chartlang LSP editor. |
| `apps/site/app/components/demo/ChartPane.tsx` | Create (port verbatim) | canvas2d adapter-driven chart preview. |
| `apps/site/app/components/demo/hybridLanguageService.ts` | Create (port verbatim) | Local LSP + `/api/compile` fetch bridge. |
| `apps/site/app/components/demo/scripts.ts` | Create (port verbatim) | Three demo `.chart.ts` source strings. |
| `apps/site/app/components/demo/EmbeddedDemo.tsx` | Create | Layout wrapper anchored at `#demo`. |
| `apps/site/app/lib/browser-stubs/esbuildStub.ts` | Create (port verbatim) | Browser stub for esbuild import. |
| `apps/site/app/lib/browser-stubs/nodeBuiltinStub.ts` | Create (port verbatim) | Browser stub for node:* builtins. |
| `apps/site/app/lib/server/compile.ts` | Create | `handleCompile` server helper. |
| `apps/site/app/routes/api/compile.ts` | Create | TanStack server route → Netlify Function. |
| `apps/site/app/routes/index.tsx` | Modify | Mount `<EmbeddedDemo />`. |
| `apps/site/app.config.ts` | Modify | Vite aliases + `server.preset: "netlify"`. |
| `apps/site/package.json` | Modify | Add CodeMirror, workspace deps, compiler dev dep, Playwright. |
| `apps/site/public/bars.json` | Create (copy) | Bar fixture for the chart preview. |
| `apps/site/tests/e2e/landing.spec.ts` | Create | Edit→compile→render smoke test. |
| `apps/site/playwright.config.ts` | Create | Standard Playwright config with `webServer` block. |

## Gates

- `pnpm install` — clean.
- `pnpm site:dev` — editor mounts; typing triggers a compile; chart
  renders; status badge cycles `compiling → ok`.
- `pnpm site:build` — green; bundle reports per-route JS size in CI
  logs (Task 6 captures these).
- `pnpm site:typecheck` — green.
- `pnpm test` — green; the new e2e suite does **not** run inside
  vitest; only the Playwright runner. Vitest's globs still skip
  `apps/*`.
- `pnpm --filter chartlang-site e2e` — Playwright suite passes
  locally (after `pnpm --filter chartlang-site e2e:install`).
- `netlify dev --command "pnpm site:dev"` (manual, optional) —
  exercise the function shape locally before pushing.
- `pnpm conformance` — unchanged; the canvas2d adapter conformance
  surface lives in `packages/conformance/`, untouched by this task.

## Changeset

None.

## Acceptance Criteria

- [ ] All seven verbatim ports copied without logic edits.
- [ ] `bars.json` available at `apps/site/public/bars.json`.
- [ ] `apps/site/app.config.ts` has the two browser-side aliases
      and `server.preset: "netlify"`.
- [ ] `/api/compile` server route returns `{ ok, moduleSource,
      manifest, diagnostics }` on a valid compile and
      `{ ok: false, diagnostics }` on a `CompileError`.
- [ ] `EmbeddedDemo` mounts at `#demo` on the home route; the nav
      link from Task 2 scrolls to it.
- [ ] `pnpm site:dev` shows the full edit→compile→render loop.
- [ ] Production build outputs a Netlify-compatible tree
      (`apps/site/.netlify/...`).
- [ ] Playwright e2e suite passes locally; PR description includes
      a screenshot or GIF of the loop.
- [ ] `examples/react-demo/` still runs (`pnpm dev`) — Task 7
      removes it.
- [ ] All other gates from prior tasks remain green.
- [ ] Every new `.ts`/`.tsx` file starts with the two-line MIT
      header.
