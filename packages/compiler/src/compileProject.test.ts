// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { EMA_CROSS, VALID_DEFINE } from "./__fixtures__/scripts.js";
import { compileProject, walkChartFiles } from "./api.js";

let workspace: string;

beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "chartlang-compile-project-"));
});

afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
});

describe("walkChartFiles", () => {
    it("returns an empty array for an empty directory", async () => {
        const files = await walkChartFiles(workspace);
        expect(files).toEqual([]);
    });

    it("discovers .chart.ts files recursively", async () => {
        await writeFile(join(workspace, "a.chart.ts"), VALID_DEFINE, "utf8");
        await mkdir(join(workspace, "nested"));
        await writeFile(join(workspace, "nested", "b.chart.ts"), VALID_DEFINE, "utf8");

        const files = await walkChartFiles(workspace);
        expect(files).toHaveLength(2);
        expect(files[0]?.endsWith("a.chart.ts")).toBe(true);
        expect(files[1]?.endsWith("b.chart.ts")).toBe(true);
    });

    it("skips node_modules and dist subtrees", async () => {
        await mkdir(join(workspace, "node_modules"));
        await writeFile(join(workspace, "node_modules", "x.chart.ts"), VALID_DEFINE, "utf8");
        await mkdir(join(workspace, "dist"));
        await writeFile(join(workspace, "dist", "y.chart.ts"), VALID_DEFINE, "utf8");
        await writeFile(join(workspace, "z.chart.ts"), VALID_DEFINE, "utf8");

        const files = await walkChartFiles(workspace);
        expect(files).toHaveLength(1);
        expect(files[0]?.endsWith("z.chart.ts")).toBe(true);
    });

    it("ignores files that don't end with .chart.ts", async () => {
        await writeFile(join(workspace, "a.ts"), "export {};", "utf8");
        await writeFile(join(workspace, "b.chart.tsx"), "export {};", "utf8");
        const files = await walkChartFiles(workspace);
        expect(files).toEqual([]);
    });

    it("survives unreadable subdirectories without throwing", async () => {
        await writeFile(join(workspace, "a.chart.ts"), VALID_DEFINE, "utf8");
        const ghost = join(workspace, "does-not-exist");
        const fromGhost = await walkChartFiles(ghost);
        expect(fromGhost).toEqual([]);
    });

    it("resolves a relative path against process.cwd()", async () => {
        const originalCwd = process.cwd();
        await writeFile(join(workspace, "x.chart.ts"), VALID_DEFINE, "utf8");
        process.chdir(workspace);
        try {
            const files = await walkChartFiles(".");
            expect(files).toHaveLength(1);
        } finally {
            process.chdir(originalCwd);
        }
    });
});

describe("compileProject", () => {
    it("returns an empty array for an empty directory", async () => {
        const results = await compileProject(workspace, { apiVersion: 1 });
        expect(results).toEqual([]);
    });

    it("compiles two .chart.ts files in parallel", async () => {
        await writeFile(join(workspace, "a.chart.ts"), VALID_DEFINE, "utf8");
        await writeFile(join(workspace, "b.chart.ts"), EMA_CROSS, "utf8");

        const results = await compileProject(workspace, { apiVersion: 1 });
        expect(results).toHaveLength(2);
        const names = results.map((r) => r.manifest.name).sort();
        expect(names).toEqual(["EMA cross", "demo"]);
    });

    it("does not write sibling files (in-memory only)", async () => {
        await writeFile(join(workspace, "a.chart.ts"), VALID_DEFINE, "utf8");
        await compileProject(workspace, { apiVersion: 1 });

        const fs = await import("node:fs/promises");
        await expect(fs.stat(join(workspace, "a.chart.js"))).rejects.toThrow();
    });
});
