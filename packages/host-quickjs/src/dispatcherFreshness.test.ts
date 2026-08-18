// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { DISPATCHER_OUTFILE, bundleDispatcher } from "../scripts/buildDispatcher.js";
import { DISPATCHER_SOURCE } from "./dispatcherSource.generated.js";

/**
 * The committed `dist/dispatcher.js` and the generated `DISPATCHER_SOURCE`
 * constant both carry the dispatcher bundle that `createQuickJsHost.ts`
 * evaluates inside QuickJS. The host now imports the generated constant (no
 * filesystem read), so a stale constant would silently run old behaviour just
 * like a stale `dist/dispatcher.js` would.
 *
 * This gate regenerates the bundle in-memory using `bundleDispatcher` (the
 * same esbuild flags `pnpm build:dispatcher` uses, single source of truth)
 * and hashes it against both committed copies.
 *
 * **What a mismatch usually means is NOT a host-quickjs edit.**
 * `bundleDispatcher()` esbuilds with `bundle: true`, so it inlines the BUILT
 * `dist` of `@invinite-org/chartlang-runtime` and, transitively,
 * `@invinite-org/chartlang-core`. A change to either package's `src` reaches the
 * QuickJS guest ONLY through this bundle, and until it is regenerated the guest
 * silently keeps running the old runtime. The remedy therefore starts upstream:
 *
 *     pnpm -F @invinite-org/chartlang-core build
 *     pnpm -F @invinite-org/chartlang-runtime build
 *     pnpm --filter @invinite-org/chartlang-host-quickjs build:dispatcher
 *
 * then commit `src/dispatcherSource.generated.ts` + `dist/dispatcher.js`.
 */
const REMEDY =
    "rebuild core + runtime, then `pnpm --filter @invinite-org/chartlang-host-quickjs " +
    "build:dispatcher` — the bundle inlines runtime's built dist, so a runtime or core " +
    "`src` edit is the usual cause";

describe("dispatcher freshness", () => {
    const hash = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");

    it("dist/dispatcher.js matches the in-memory bundle (a runtime/core src edit is the usual cause)", async () => {
        const [committed, rebuilt] = await Promise.all([
            readFile(DISPATCHER_OUTFILE, "utf8"),
            bundleDispatcher(),
        ]);

        expect(
            hash(rebuilt),
            `rebuilt vs committed dist/dispatcher.js sha256 mismatch: ${REMEDY}`,
        ).toBe(hash(committed));
    });

    it("DISPATCHER_SOURCE constant matches the in-memory bundle (a runtime/core src edit is the usual cause)", async () => {
        const rebuilt = await bundleDispatcher();

        expect(
            hash(DISPATCHER_SOURCE),
            `generated DISPATCHER_SOURCE vs rebuilt bundle sha256 mismatch: ${REMEDY}`,
        ).toBe(hash(rebuilt));
    });
});
