// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { bundleModule } from "./bundle.js";

// Pinned seed: deterministic across runs so a flaky failure shows up
// the same way for everyone. Property: `bundleModule` is idempotent —
// two calls with the same input yield byte-identical `moduleSource`.
const SEED = 0x1c0de;

describe("bundleModule — properties", () => {
    it("is deterministic across re-runs for the same transformedSource", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 32 }),
                fc.boolean(),
                async (count, minify) => {
                    // Synthesise a tiny TS module of N exported numeric
                    // constants — varies the input shape across runs.
                    const lines: string[] = [];
                    for (let i = 0; i < count; i++) {
                        lines.push(`const __v${i}: number = ${i};`);
                    }
                    lines.push(
                        `export default [${Array.from({ length: count }, (_, i) => `__v${i}`).join(", ")}];`,
                    );
                    const source = lines.join("\n");
                    const a = await bundleModule({
                        transformedSource: source,
                        sourcePath: "prop.chart.ts",
                        sourcemap: false,
                        minify,
                    });
                    const b = await bundleModule({
                        transformedSource: source,
                        sourcePath: "prop.chart.ts",
                        sourcemap: false,
                        minify,
                    });
                    expect(a.moduleSource).toBe(b.moduleSource);
                },
            ),
            { seed: SEED, numRuns: 10 },
        );
    });

    it("synthesises the shim deterministically when producers are inlined", async () => {
        await fc.assert(
            fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (producerCount) => {
                const producers = Array.from({ length: producerCount }, (_, i) => ({
                    hash: `p${i.toString(16).padStart(6, "0")}`,
                    rewrittenSource: `const __producer_p${i.toString(16).padStart(6, "0")}__default = ${i};`,
                }));
                const a = await bundleModule({
                    transformedSource: "export default 1;\n",
                    sourcePath: "prop.chart.ts",
                    sourcemap: false,
                    minify: false,
                    inlinedProducers: producers,
                });
                const b = await bundleModule({
                    transformedSource: "export default 1;\n",
                    sourcePath: "prop.chart.ts",
                    sourcemap: false,
                    minify: false,
                    inlinedProducers: producers,
                });
                expect(a.moduleSource).toBe(b.moduleSource);
                expect(a.moduleSource).toContain("__chartlang_depOutput");
            }),
            { seed: SEED, numRuns: 10 },
        );
    });
});
