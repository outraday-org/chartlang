// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bench, describe } from "vitest";

import { EMA_CROSS, MULTI_EXPORT_COMPOSITION } from "./__fixtures__/scripts.js";
import { compile, compileProject } from "./api.js";

describe("compile — bench", () => {
    bench("EMA-cross end-to-end compile", async () => {
        await compile(EMA_CROSS, { apiVersion: 1, sourcePath: "ema-cross.chart.ts" });
    });

    bench("multi-export composition end-to-end compile", async () => {
        await compile(MULTI_EXPORT_COMPOSITION, {
            apiVersion: 1,
            sourcePath: "composition.chart.ts",
        });
    });

    bench("cross-file diamond end-to-end compileProject", async () => {
        const dir = await mkdtemp(join(tmpdir(), "diamond-bench-"));
        try {
            const fixturesDir = new URL("./__fixtures__/cross-file-diamond/", import.meta.url);
            for (const name of [
                "base.chart.ts",
                "fast.chart.ts",
                "slow.chart.ts",
                "crossover.chart.ts",
            ]) {
                const content = await readFile(new URL(name, fixturesDir), "utf8");
                await writeFile(join(dir, name), content, "utf8");
            }
            await compileProject(dir, { apiVersion: 1 });
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
