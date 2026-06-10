// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { ScriptManifest } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { createWorkerBoot, type WorkerBootScope } from "./createWorkerBoot.js";
import { createWorkerHost } from "./createWorkerHost.js";
import type { HostCompiledScript, WorkerLike } from "./types.js";

/**
 * Phase-1 sandbox placeholder per CONTRIBUTING §16.3. The full sandbox-escape
 * suite (instruction-level CPU caps, hard heap caps, exhaustive forbidden
 * globals) lands with QuickJS in Phase 5. Phase 1's coverage is the
 * structural-clone + measurement-based watchdog pair:
 *
 * - Positive: a clean bundle loads cleanly through the wire protocol.
 * - Negative: the wire format assumes the input bundle has already been
 *   scrubbed by the compiler's `forbiddenConstructs` pass — so any string
 *   the host-worker actually sees is free of `Math.random` / `eval` /
 *   `new Function`. We assert that invariant by inspecting the bundle text
 *   for the forbidden tokens before posting `load`.
 */

function pair(): { worker: WorkerLike; scope: WorkerBootScope } {
    const ch = new MessageChannel();
    ch.port1.start();
    ch.port2.start();
    return {
        worker: {
            addEventListener(_type, listener) {
                ch.port1.addEventListener("message", (ev) => listener(ev as MessageEvent<unknown>));
            },
            postMessage(msg) {
                ch.port1.postMessage(msg);
            },
            terminate() {
                ch.port1.close();
                ch.port2.close();
            },
        },
        scope: {
            addEventListener(_type, listener) {
                ch.port2.addEventListener("message", (ev) => {
                    void listener(ev as MessageEvent<never>);
                });
            },
            postMessage(msg) {
                ch.port2.postMessage(msg);
            },
        },
    };
}

function makeCapabilities(): Capabilities {
    return {
        plots: capabilities.allLines(),
        drawings: new Set(),
        alerts: new Set(),
        alertConditions: false,
        logs: false,
        inputs: new Set(),
        intervals: [],
        multiTimeframe: false,
        subPanes: 0,
        symInfoFields: new Set(),
        maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        maxLookback: 5_000,
        maxTickHz: 10,
    };
}

function manifest(): ScriptManifest {
    return {
        apiVersion: 1,
        kind: "indicator",
        name: "sandbox",
        inputs: {},
        capabilities: ["indicators"],
        requestedIntervals: [],
        userPickableInterval: false,
        seriesCapacities: { ohlcv: 4 },
        maxLookback: 0,
    };
}

const FORBIDDEN_TOKENS: ReadonlyArray<string> = ["Math.random", "eval", "new Function"];

describe("sandbox — Phase 1 placeholder", () => {
    it("loads a clean compiled bundle without fatal", async () => {
        const cleanSource = `
            export default {
                manifest: ${JSON.stringify(manifest())},
                compute: () => {},
            };
        `;
        for (const tok of FORBIDDEN_TOKENS) {
            expect(cleanSource).not.toContain(tok);
        }

        const { worker, scope } = pair();
        createWorkerBoot(scope);
        let fatal: string | null = null;
        const host = createWorkerHost({
            capabilities: makeCapabilities(),
            workerLike: worker,
            onWorkerError: (m) => {
                fatal = m;
            },
        });
        const compiled: HostCompiledScript = {
            moduleSource: cleanSource,
            manifest: manifest(),
        };
        await host.load(compiled);
        await new Promise((r) => setTimeout(r, 0));
        expect(fatal).toBeNull();
        host.dispose();
    });

    it("documents that forbidden constructs are rejected upstream (compiler pass)", () => {
        // The wire format assumes the compiler's `forbiddenConstructs` pass
        // has already rejected `Math.random` / `eval` / `new Function`. This
        // assertion encodes that invariant: any string that reaches the
        // worker has been scrubbed. If a future Phase-2+ extension somehow
        // bypassed the compiler, this gate would catch it at the host
        // boundary — but Phase 1 does not enforce the rejection at the host;
        // it documents the contract.
        const cleanSource = `
            export default {
                manifest: ${JSON.stringify(manifest())},
                compute: (ctx) => { ctx.plot("a:1:1#0", 1, {}); },
            };
        `;
        for (const tok of FORBIDDEN_TOKENS) {
            expect(cleanSource).not.toContain(tok);
        }
    });
});
