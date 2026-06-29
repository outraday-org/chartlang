// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Adapter matrix — proves the activeAdapter seam is genuinely interchangeable
// across ALL bundled libraries, not just the default webgl. The whole
// point of `src/lib/chart/activeAdapter.ts` is library-interchange; this is
// the guarantee that any library the create-chartlang installer can pick
// (canvas2d, lightweight-charts, uplot, echarts, konva, webgl) builds a chart
// bundle in the starter.
//
// Strategy (the task's "lighter build-per-variant" variant): for each entry
// in SEAM_VARIANTS, swap `activeAdapter.ts` to that variant's seamSource, run
// the production `vite build`, and assert it succeeds — this proves the chosen
// library resolves + bundles through the seam (import line + factory call +
// render entry) with zero network, inside the monorepo. webgl (the committed
// default) is restored in afterAll. A green matrix means the seam is not
// webgl-only. (The default webgl path also has a live render + alert-toast
// mount assertion in chart.spec.ts.)
//
// This spec MUTATES a shared source file (`activeAdapter.ts`), so the whole
// file runs SERIALLY and the identity check runs FIRST, before any swap. It
// must not run in parallel with anything that reads `activeAdapter.ts`; the
// other specs drive the already-built preview and never touch the file.
//
// The deep drawing-correctness gate lives in multi-library-adapters
// conformance; this stays a build (resolve + bundle) smoke per id.

import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { expect, test } from "@playwright/test"

import { SEAM_VARIANTS } from "../src/lib/chart/seamVariants"

const ACTIVE_ADAPTER_PATH = fileURLToPath(
  new URL("../src/lib/chart/activeAdapter.ts", import.meta.url),
)
const APP_DIR = fileURLToPath(new URL("..", import.meta.url))

const WEBGL_SOURCE = SEAM_VARIANTS.find((v) => v.id === "webgl")?.seamSource ?? ""

test.describe("adapter matrix", () => {
  // Serial: every case rewrites the shared activeAdapter.ts then builds, and
  // the identity check must read the pristine file before any swap.
  test.describe.configure({ mode: "serial", timeout: 300_000 })

  test.afterAll(() => {
    // Restore the committed webgl default no matter what.
    writeFileSync(ACTIVE_ADAPTER_PATH, WEBGL_SOURCE)
  })

  // The committed activeAdapter.ts must equal the webgl variant verbatim —
  // it is the single seam SSOT rendered into the file. (Also guards Task 7's
  // installer, which emits byte-identical bodies from SEAM_VARIANTS.) Runs
  // first, before any case swaps the file.
  test("committed activeAdapter.ts equals SEAM_VARIANTS.webgl verbatim", () => {
    expect(readFileSync(ACTIVE_ADAPTER_PATH, "utf8")).toBe(WEBGL_SOURCE)
  })

  for (const variant of SEAM_VARIANTS) {
    test(`builds the ${variant.id} (${variant.mount}) seam`, () => {
      writeFileSync(ACTIVE_ADAPTER_PATH, variant.seamSource)
      // Build into a throwaway out dir so the matrix never overwrites the
      // app's served `dist` (the preview powering the other specs).
      const outDir = mkdtempSync(join(tmpdir(), `cl-matrix-${variant.id}-`))
      try {
        // A non-zero exit (unresolved import / type error / bundle failure)
        // throws and fails the case. stdio is piped so a failure surfaces the
        // build output in the test report.
        expect(() =>
          execFileSync(
            "pnpm",
            ["exec", "vite", "build", "--outDir", outDir, "--emptyOutDir"],
            { cwd: APP_DIR, stdio: "pipe", encoding: "utf8" },
          ),
        ).not.toThrow()
      } finally {
        rmSync(outDir, { recursive: true, force: true })
      }
    })
  }
})
