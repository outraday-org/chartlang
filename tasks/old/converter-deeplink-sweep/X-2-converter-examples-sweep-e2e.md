# Converter examples sweep e2e

> **Status: COMPLETE**

## Goal

Add a Playwright e2e spec that drives **every** `PINE_SCRIPTS` sample
through the converter via the `?script=` deep-link: non-`rejects`
samples must convert + compile + render a chart; `rejects` samples must
be refused (error diagnostic + disabled Compile button). No sample may
fire an uncaught page/console error. This is the converter analogue of
the demo's 229×6 sweep — a repeatable CI gate over the full Pine →
chartlang → compile → render path.

## Prerequisites

- **Task 1** — the `?script=` write-back/round-trip. The sweep
  deep-links each sample by URL; it relies on the param resolving the
  correct sample on load (read path, already present) and benefits from
  the mount seed for a stable URL.

## Current Behavior

`apps/site/tests/e2e/converter.spec.ts` covers ONE happy-path sample +
ONE reject via the dialog. The remaining ~40 samples are unverified;
nothing catches a sample that silently stops converting, fails to
compile, renders a blank chart, or — for a `rejects` sample — quietly
lowers a forbidden construct instead of refusing it.

## Desired Behavior

One spec (`converter-examples.spec.ts`) with a generated test per
`PINE_SCRIPTS` entry (Playwright `for (const s of PINE_SCRIPTS) test(...)`),
sharded automatically across workers by `fullyParallel: true`:

- **non-`rejects`:** the converted output shows `defineIndicator`,
  `button.compile-button` is enabled, clicking it renders a non-empty
  `canvas.chart-canvas`, and the status is not an error.
- **`rejects`:** `.converter-diagnostics .diagnostic.is-error` is
  visible AND `button.compile-button` is disabled.
- **all:** no `pageerror` / `console.error` while the listeners are
  attached.

## Requirements

### 1. New spec `apps/site/tests/e2e/converter-examples.spec.ts`

Import the catalogue directly (it is pure data — strings only, no
React/Node — so importing it into the test is safe and keeps the sweep
auto-synced with new samples):

```ts
import { expect, test, type Page } from "@playwright/test"
import { PINE_SCRIPTS } from "../../src/components/converter/pineScripts"
```

Each sample's full convert→compile→render exceeds the 30s default:

```ts
test.setTimeout(120_000)
```

### 2. Console / page-error guard

Copy the `trackErrors(page)` helper from `demo-adapters.spec.ts`
(records `pageerror` + `console.error`, returns a `stop()` that asserts
the arrays are empty). Attach at the start of each test, `stop()` at the
end.

### 3. Per-sample test body

```ts
for (const sample of PINE_SCRIPTS) {
  test(`converter sample: ${sample.id} (${sample.category})`, async ({ page }) => {
    const stop = trackErrors(page)
    await page.goto(`/converter?script=${sample.id}`)

    const converter = page.locator(".cl-converter")
    // Pine input mounts and the live convert ran (output editor is present).
    await expect(converter.locator(".pane-editor .cm-content")).toBeVisible({ timeout: 30_000 })
    const output = converter.locator(".output-editor .cm-content")
    const compileButton = converter.locator("button.compile-button")

    if (sample.category === "rejects") {
      // Intentional hard-reject: an error diagnostic shows and compile is
      // disabled (a reject that compiled is a failure).
      const diagnostics = converter.locator(".converter-diagnostics")
      await expect(diagnostics.locator(".diagnostic.is-error").first()).toBeVisible({ timeout: 30_000 })
      await expect(compileButton).toBeDisabled()
    } else {
      // Convert produced a chartlang indicator; compile + render it.
      await expect(output).toContainText("defineIndicator", { timeout: 30_000 })
      await expect(compileButton).toBeEnabled({ timeout: 30_000 })
      await compileButton.click()
      const canvas = converter.locator("canvas.chart-canvas")
      await expect(canvas).toBeVisible({ timeout: 60_000 })
      await expect
        .poll(
          () => canvas.evaluate((n) => (n as HTMLCanvasElement).toDataURL().length),
          { timeout: 30_000 },
        )
        .toBeGreaterThan(1000)
      // The status must not be the error state after a successful compile.
      await expect(converter.locator(".compile-status.is-error")).toHaveCount(0)
    }

    stop()
  })
}
```

Mirror the bitmap-length threshold (`> 1000`) and `canvas.chart-canvas`
selector from the existing `converter.spec.ts` compile assertion.

### Edge cases

- **`rejects` category (assert refusal):** `hasError` is `true` for
  these (an error-severity diagnostic), which keeps `button.compile-button`
  `disabled` per `CompilePreview.tsx:175`. Assert BOTH the visible
  `.diagnostic.is-error` and the disabled button. Do NOT click compile
  for a reject.
- **Warning-only samples:** a non-`rejects` sample may emit
  warning-severity diagnostics (e.g. fold-to-overlay, multi-return-arg
  dropped). Warnings do not set `hasError`, so the button stays enabled
  and the chart renders — assert on `.compile-status.is-error` count `0`
  (warnings render a non-error status), NOT on the absence of all
  diagnostics.
- **Render adapter:** the converter preview is canvas2d only
  (`DEFAULT_ADAPTER_ID`), so the bitmap lives on `canvas.chart-canvas`
  (the canvas2d driver's class). There is no adapter switcher to iterate.
- **Server-backed compile:** clicking compile POSTs to the real
  `/api/compile`, which only works against the **built** server bundle
  — the `playwright.config.ts` `webServer` already runs
  `vite build && vite preview --port 3201`, so no extra setup is needed.
- **Parallelism / flake:** `fullyParallel: true` shards the generated
  tests across workers; the shared preview server handles the concurrent
  `/api/compile` posts (the demo sweep already proved this is fine).
  Keep the per-test 120s budget for the compile + canvas-paint settle.
- **New samples auto-covered:** because the loop iterates the imported
  `PINE_SCRIPTS`, adding a sample to `pineScripts.ts` adds a test with no
  spec edit — the gate stays exhaustive.

### 4. Docs — `apps/CLAUDE.md`

Add one bullet noting `converter-examples.spec.ts` sweeps every
`PINE_SCRIPTS` entry (convert + compile + render; `rejects` asserted as
refusals), as the converter analogue of the demo e2e specs.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/site/tests/e2e/converter-examples.spec.ts` | Create | Per-sample sweep: convert + compile + render; `rejects` → assert refusal; console/page-error guard |
| `apps/CLAUDE.md` | Modify | Note the converter examples sweep spec |

## Gates

- `pnpm site:typecheck` (the spec imports `PINE_SCRIPTS` — must
  type-check)
- `pnpm site:build`
- `pnpm site:e2e` (Playwright — the new spec, built + previewed on
  `:3201`; part of `pnpm check:all`)
- Biome: match the existing e2e specs' style (2-space, no semicolons);
  `apps/**` is Biome-ignored at the repo root, so follow local
  `tests/e2e/*.spec.ts` conventions.

## Changeset

None — `apps/site` is `"private": true` (test-only addition).

## Acceptance Criteria

- A test exists for every `PINE_SCRIPTS` entry (generated from the
  imported catalogue — no hand-maintained list).
- Every non-`rejects` sample converts, compiles, and renders a
  non-empty `canvas.chart-canvas` with no error status.
- Every `rejects` sample shows a `.diagnostic.is-error` and a disabled
  `button.compile-button`.
- No sample fires a `pageerror` / `console.error`.
- `site:typecheck`, `site:build`, and the full e2e suite are green.
- `apps/CLAUDE.md` documents the sweep spec.
