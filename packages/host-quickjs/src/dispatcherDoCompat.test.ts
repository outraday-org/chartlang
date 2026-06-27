// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * DO-compat regression gate. `createQuickJsHost` must import and construct a
 * host without any module-scope `node:fs` / `node:path` / `node:url` access, so
 * it loads inside a Cloudflare Worker / Durable Object (which has no
 * filesystem). We mock the exact APIs the old `readFileSync` path used to
 * throw if any of them runs during import or construction; reintroducing a
 * filesystem read at module scope fails this test.
 */
describe("createQuickJsHost DO-compat (no filesystem access)", () => {
    afterEach(() => {
        vi.resetModules();
        vi.doUnmock("node:fs");
        vi.doUnmock("node:path");
        vi.doUnmock("node:url");
    });

    function makeCapabilities(): Capabilities {
        return {
            plots: capabilities.allLines(),
            drawings: capabilities.allPhase3Drawings(),
            alerts: new Set(["default"]),
            alertConditions: false,
            logs: false,
            inputs: new Set(),
            intervals: [],
            multiTimeframe: false,
            multiSymbol: false,
            subPanes: 0,
            symInfoFields: new Set(),
            maxDrawingsPerScript: { lines: 10, labels: 10, boxes: 10, polylines: 10, other: 10 },
            maxLookback: 5_000,
            maxTickHz: 10,
        };
    }

    it("imports and constructs a host with node:fs/path/url forbidden", async () => {
        const forbid = (name: string) => () => {
            throw new Error(`${name} must not run at module scope (DO-compat regression)`);
        };

        vi.doMock("node:fs", () => ({
            readFileSync: forbid("node:fs.readFileSync"),
            default: { readFileSync: forbid("node:fs.readFileSync") },
        }));
        vi.doMock("node:path", () => ({
            dirname: forbid("node:path.dirname"),
            resolve: forbid("node:path.resolve"),
            default: { dirname: forbid("node:path.dirname"), resolve: forbid("node:path.resolve") },
        }));
        vi.doMock("node:url", () => ({
            fileURLToPath: forbid("node:url.fileURLToPath"),
            default: { fileURLToPath: forbid("node:url.fileURLToPath") },
        }));

        vi.resetModules();
        const mod = await import("./createQuickJsHost.js");

        expect(typeof mod.createQuickJsHost).toBe("function");
        // Construction is lazy — it stores the QuickJS factory and never boots
        // the runtime — so it must succeed without any filesystem access.
        const host = mod.createQuickJsHost({ capabilities: makeCapabilities() });
        expect(typeof host.load).toBe("function");
        expect(host.limits.maxRingBufferBars).toBe(5_000);
    });
});
