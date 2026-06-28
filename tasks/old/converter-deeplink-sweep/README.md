# Converter `?script=` Deep-Link Sync + Examples Sweep

## Overview

Make the Pine → chartlang **converter playground** deep-linkable the
same way the landing demo is, then add a Playwright e2e sweep that
drives **every** converter sample through the full
Pine → chartlang → compile → render path (clicking "Compile & preview")
and asserts the intentional `rejects` category is correctly refused.

Two pieces:

1. **URL sync** — the converter already *reads* `?script=<id>` on load
   (`ConverterBody.tsx` `initialScriptId`), but it never *writes* it
   back when you pick a different sample, so the deep-link does not
   round-trip. Task 1 adds the write-back (on select + a mount seed),
   mirroring the demo's `DemoBody` exactly.
2. **Sweep e2e** — Task 2 iterates `PINE_SCRIPTS` via the now-complete
   deep-link, converts each sample, clicks **Compile & preview**, and
   asserts a chart renders — except the `rejects` category, where it
   asserts the converter refuses (error diagnostic + disabled button).

Both tasks live entirely in `apps/site/` (a private, non-`§22.4` app —
see `apps/CLAUDE.md`): no coverage/changeset/conformance gates apply;
the relevant gates are `pnpm site:typecheck`, `pnpm site:build`, and the
Playwright e2e suite (`pnpm site:e2e`, part of `pnpm check:all`).

## Current State

- **Converter route:** `/converter` → `ConverterBody` (client-only,
  lazy). `initialScriptId()` (`ConverterBody.tsx:28-33`) reads
  `?script=<id>` and falls back to `PINE_SCRIPTS[0]` for a
  missing/unknown id. **There is no write-back** — `switchScript`
  (`ConverterBody.tsx:49-53`) updates React state only, so selecting a
  sample via the `PineExampleBrowser` dialog leaves the URL stale.
- **Demo (the pattern to mirror):** `DemoBody.tsx` has `syncDemoParam`
  (`:57-63`, `history.replaceState`, preserves pathname/hash/other
  params) and a mount `useEffect` (`:111-115`) that seeds the URL with
  the resolved selection. Selecting a script also calls it.
- **Samples:** `PINE_SCRIPTS: ReadonlyArray<PineScript>` (pure data —
  `{ id, label, description, category, source }`) in
  `apps/site/src/components/converter/pineScripts.ts`. `PineCategory`
  includes `"rejects"` (intentional hard-rejects: `for…in`, recursive
  UDF, unbounded Camp C handles) ordered last in `CATEGORY_ORDER`.
- **Compile + render:** `CompilePreview.tsx` — `button.compile-button`
  is `disabled` when `output === null || hasError || compiling`
  (`:175`); on click it POSTs the converted output to the real
  `/api/compile` and lazy-mounts the demo's `ChartPane` (adapter
  `DEFAULT_ADAPTER_ID` = canvas2d → `canvas.chart-canvas`). `hasError`
  is `true` exactly when conversion emits an error-severity diagnostic
  (`ConverterBody.tsx:47`), which is the steady state for the `rejects`
  category.
- **e2e:** `apps/site/tests/e2e/converter.spec.ts` (one smoke test
  driving the default sample + a reject via the dialog).
  `demo-examples.spec.ts` is the `?script=` deep-link reference.
  `demo-adapters.spec.ts` has the `trackErrors(page)` console/page-error
  guard. `playwright.config.ts` builds + previews on `:3201`,
  `fullyParallel: true`.

## Target State

- Selecting a Pine sample (or loading with a missing/unknown
  `?script=`) leaves `/converter?script=<id>` in the address bar — a
  shareable deep-link that round-trips, byte-for-concept with the demo.
- A `converter-examples.spec.ts` e2e iterates **every** `PINE_SCRIPTS`
  entry:
  - **non-`rejects`:** converts (output shows `defineIndicator`),
    Compile & preview is enabled, clicking it renders a non-empty
    `canvas.chart-canvas`, and the status is not an error.
  - **`rejects`:** an error-severity diagnostic shows in
    `.converter-diagnostics` and `button.compile-button` is **disabled**
    (a reject that compiled is a test failure).
  - No uncaught `pageerror` / `console.error` fires for any sample.

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Mirror `DemoBody.syncDemoParam` exactly (local `syncConverterParam`)** | The demo's `history.replaceState` write-back (no router nav, preserves pathname/hash/other params) is the proven pattern for a client-only lazy body. A local copy keeps the converter self-contained — `DemoBody`'s helper is module-private and the two bodies must not cross-import. |
| **Seed the URL on mount, not only on select** | A page loaded with a missing/unknown `?script=` falls back to the first sample; the mount seed writes that resolved id back so the URL always reflects what is shown (demo parity, and the sweep can trust the deep-link). |
| **Sweep imports `PINE_SCRIPTS` (id + category) from app source** | `pineScripts.ts` is pure data (no React/Node), so the e2e can import it directly and auto-cover every new sample — no hand-maintained literal list to drift (unlike `demo-adapters.spec.ts`, which avoided importing heavy app source). |
| **`rejects` asserted as expected-refusals, not skipped** | The whole point of the `rejects` category is that the converter refuses them; the sweep must prove the refusal (error diagnostic + disabled compile) so a regression that silently lowers a forbidden construct is caught. |
| **canvas2d only for the preview render** | `CompilePreview` hard-codes `DEFAULT_ADAPTER_ID` (canvas2d, `canvas.chart-canvas`), so the sweep reads that one bitmap — the converter has no adapter switcher to iterate (unlike the demo's 6). |

## Dependency Graph

```
Task 1 (converter ?script= write-back sync + deep-link e2e)
  |
  v
Task 2 (converter-examples sweep e2e — relies on the round-trip deep-link)
```

## Task Summary Table

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Converter `?script=` URL write-back sync](./1-converter-script-param-sync.md) | apps/site | None | Low |
| 2 | [Converter examples sweep e2e](./2-converter-examples-sweep-e2e.md) | apps/site | 1 | Medium |

## Code Reuse

| Existing | Location | Used by |
|----------|----------|---------|
| `syncDemoParam` (write-back pattern to mirror) | `apps/site/src/components/demo/DemoBody.tsx:57-63` | Task 1 (`syncConverterParam`) |
| `initialScriptId` (read deep-link, already present) | `apps/site/src/components/converter/ConverterBody.tsx:28-33` | Task 1 |
| `PINE_SCRIPTS` / `PineScript` / `PineCategory` | `apps/site/src/components/converter/pineScripts.ts` | Task 2 (iterate id + category) |
| `trackErrors(page)` console/page-error guard | `apps/site/tests/e2e/demo-adapters.spec.ts` | Task 2 (copy the pattern) |
| `?script=` deep-link e2e shape | `apps/site/tests/e2e/demo-examples.spec.ts` | Task 1 |
| Converter selectors (`.cl-converter`, `.output-editor .cm-content`, `button.compile-button`, `canvas.chart-canvas`, `.converter-diagnostics`, `.diagnostic.is-error`) | `apps/site/tests/e2e/converter.spec.ts` | Tasks 1 & 2 |

## Provenance

None — no `../invinite/` port. All changes are app-local (`apps/site/`).

## Deferred / Follow-Up Work

- Visual-diff / screenshot baselines for the converted charts (the
  sweep asserts "renders + no error", not pixel-correctness).
- A `?strict=` / `?interval=` deep-link for the converter's other
  controls (`ConverterControls`) — out of scope; only `?script=` here.
- Mirroring the sync for the demo's `#demo` hash anchor on the
  converter (the converter has no in-page anchor today).
