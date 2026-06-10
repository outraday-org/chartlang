// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { DISPATCHER_OUTFILE, bundleDispatcher } from "../scripts/buildDispatcher.js";

/**
 * The committed `dist/dispatcher.js` is read by `createQuickJsHost.ts` at
 * module load and evaluated inside QuickJS. A source-tree fix to
 * `moduleSourceToScript.ts` (or any other dispatcher dep) goes silently inert
 * if the contributor forgets to re-bundle — tests pass against old behaviour.
 *
 * This gate regenerates the bundle in-memory using `bundleDispatcher` (the
 * same esbuild flags `pnpm build:dispatcher` uses, single source of truth)
 * and hashes both sides. A mismatch points the contributor at `pnpm build`.
 */
describe("dispatcher freshness", () => {
    it("dist/dispatcher.js matches the in-memory bundle (run `pnpm build` if this fails)", async () => {
        const [committed, rebuilt] = await Promise.all([
            readFile(DISPATCHER_OUTFILE, "utf8"),
            bundleDispatcher(),
        ]);

        const hash = (text: string): string =>
            createHash("sha256").update(text, "utf8").digest("hex");

        expect(hash(rebuilt), "rebuilt vs committed dist/dispatcher.js sha256 mismatch").toBe(
            hash(committed),
        );
    });
});
