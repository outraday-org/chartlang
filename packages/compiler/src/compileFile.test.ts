// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import * as fs from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { EMA_CROSS, MULTI_EXPORT_COMPOSITION } from "./__fixtures__/scripts.js";
import { compileFile, writeAtomic } from "./api.js";

let workspace: string;

beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "chartlang-compile-file-"));
});

afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
});

describe("compileFile", () => {
    it("writes the .chart.js / .chart.manifest.json / .chart.d.ts sibling files when write !== false", async () => {
        const sourcePath = join(workspace, "ema.chart.ts");
        await fs.writeFile(sourcePath, EMA_CROSS, "utf8");

        const result = await compileFile(sourcePath, { apiVersion: 1 });

        const jsContent = await fs.readFile(join(workspace, "ema.chart.js"), "utf8");
        const manifestContent = await fs.readFile(
            join(workspace, "ema.chart.manifest.json"),
            "utf8",
        );
        const dtsContent = await fs.readFile(join(workspace, "ema.chart.d.ts"), "utf8");

        expect(jsContent).toBe(result.moduleSource);
        expect(JSON.parse(manifestContent).name).toBe("EMA cross");
        expect(dtsContent).toBe(result.types);
    });

    it("returns without writing when write: false", async () => {
        const sourcePath = join(workspace, "ema.chart.ts");
        await fs.writeFile(sourcePath, EMA_CROSS, "utf8");

        await compileFile(sourcePath, { apiVersion: 1, write: false });

        await expect(fs.stat(join(workspace, "ema.chart.js"))).rejects.toThrow();
    });

    it("forwards declaredIntervals to the lower-tf validation", async () => {
        const sourcePath = join(workspace, "ltf.chart.ts");
        await fs.writeFile(
            sourcePath,
            `import { defineIndicator, request } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ltf",
    apiVersion: 1,
    compute: () => {
        request.lowerTf({ interval: "1D" });
    },
});
`,
            "utf8",
        );

        await expect(
            compileFile(sourcePath, {
                apiVersion: 1,
                write: false,
                declaredIntervals: [{ value: "1m", label: "1 minute", group: "minute" }],
            }),
        ).rejects.toThrow("lower-tf-not-lower");
    });

    it("writes an external sourcemap sibling when sourcemap: 'external'", async () => {
        const sourcePath = join(workspace, "ema.chart.ts");
        await fs.writeFile(sourcePath, EMA_CROSS, "utf8");

        await compileFile(sourcePath, { apiVersion: 1, sourcemap: "external" });

        const mapStat = await fs.stat(join(workspace, "ema.chart.js.map"));
        expect(mapStat.isFile()).toBe(true);
    });

    it("does not write a .map sibling when sourcemap is inline", async () => {
        const sourcePath = join(workspace, "ema.chart.ts");
        await fs.writeFile(sourcePath, EMA_CROSS, "utf8");

        await compileFile(sourcePath, { apiVersion: 1, sourcemap: "inline" });

        await expect(fs.stat(join(workspace, "ema.chart.js.map"))).rejects.toThrow();
    });

    it("derives a POSIX-relative sourcePath from cwd", async () => {
        const sourcePath = join(workspace, "rel.chart.ts");
        await fs.writeFile(sourcePath, EMA_CROSS, "utf8");

        const result = await compileFile(sourcePath, { apiVersion: 1, write: false });
        const slot = result.moduleSource.match(/"[^"]+\.chart\.ts:\d+:\d+#0"/);
        expect(slot?.[0]).toBeTruthy();
    });

    it("honours an absolute opts.sourcePath override", async () => {
        const sourcePath = join(workspace, "ema.chart.ts");
        await fs.writeFile(sourcePath, EMA_CROSS, "utf8");

        const result = await compileFile(sourcePath, {
            apiVersion: 1,
            write: false,
            sourcePath: "custom.chart.ts",
        });
        expect(result.moduleSource).toContain('"custom.chart.ts:');
    });

    it("propagates minify + target options to the bundler", async () => {
        const sourcePath = join(workspace, "ema.chart.ts");
        await fs.writeFile(sourcePath, EMA_CROSS, "utf8");

        const result = await compileFile(sourcePath, {
            apiVersion: 1,
            write: false,
            minify: true,
            target: "es2022",
        });
        expect(result.moduleSource.length).toBeGreaterThan(0);
    });

    it("resolves a relative path against process.cwd()", async () => {
        const sourcePath = join(workspace, "rel.chart.ts");
        await fs.writeFile(sourcePath, EMA_CROSS, "utf8");
        const originalCwd = process.cwd();
        process.chdir(workspace);
        try {
            const result = await compileFile("rel.chart.ts", { apiVersion: 1, write: false });
            expect(result.manifest.name).toBe("EMA cross");
        } finally {
            process.chdir(originalCwd);
        }
    });
});

describe("writeAtomic", () => {
    it("writes the file content to disk", async () => {
        const target = join(workspace, "atomic.txt");
        await writeAtomic(target, "hello");
        const content = await fs.readFile(target, "utf8");
        expect(content).toBe("hello");
    });

    it("throws and cleans up the temp file when rename fails (target is a non-empty dir)", async () => {
        const target = join(workspace, "atomic-target");
        // Make the target an existing non-empty directory — `rename` rejects when
        // the destination is a non-empty directory on POSIX + Windows.
        await fs.mkdir(target);
        await fs.writeFile(join(target, "marker"), "x", "utf8");

        await expect(writeAtomic(target, "hi")).rejects.toThrow();

        const entries = await fs.readdir(workspace);
        const leaked = entries.filter((name) => name.startsWith("atomic-target.tmp."));
        expect(leaked).toEqual([]);
    });

    it("writes an array-shape sidecar JSON for multi-export files", async () => {
        const sourcePath = join(workspace, "multi.chart.ts");
        await fs.writeFile(sourcePath, MULTI_EXPORT_COMPOSITION, "utf8");

        await compileFile(sourcePath, { apiVersion: 1 });

        const manifestContent = await fs.readFile(
            join(workspace, "multi.chart.manifest.json"),
            "utf8",
        );
        const parsed = JSON.parse(manifestContent) as Array<{ exportName: string }>;
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed[0]?.exportName).toBe("default");
        expect(parsed[1]?.exportName).toBe("sibling");
    });

    it("swallows the unlink failure when the temp file never landed on disk", async () => {
        // Target lives under a directory that does not exist. `writeFile` fails
        // immediately so the temp file is never created; the catch-block tries
        // to `unlink` it anyway, hits ENOENT, and silently moves on. The
        // original write error is what `writeAtomic` re-throws.
        const target = join(workspace, "missing-dir", "atomic-noent.txt");
        await expect(writeAtomic(target, "hi")).rejects.toThrow();

        const entries = await fs.readdir(workspace);
        expect(entries).toEqual([]);
    });
});
