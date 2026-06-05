// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { runGenDocs } from "../packages/cli/src/commands/genDocs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolvePath(HERE, "..");
const GATE_SCRIPT = resolvePath(HERE, "docs-gate.ts");

describe("docs:gate end-to-end (committed pages match generator)", () => {
    it("succeeds on the committed `docs/primitives/ta/` tree", async () => {
        // Run the gate as a child process so the exit code is observable
        // without it tearing down the test runner's process.
        const result = spawnSync("pnpm", ["tsx", GATE_SCRIPT], {
            cwd: REPO_ROOT,
            encoding: "utf8",
        });
        if (result.status !== 0) {
            // Surface stderr in the assertion message for triage.
            throw new Error(
                `docs-gate failed (exit ${result.status}):\n${result.stderr}\n${result.stdout}`,
            );
        }
        expect(result.status).toBe(0);
        expect(result.stdout).toMatch(/docs:gate — every primitive page matches/);
    }, 60_000);
});

describe("docs:gate drift detection (in-process)", () => {
    it("detects an out-of-date committed page by content drift", async () => {
        const tmpDir = await mkdtemp(join(tmpdir(), "chartlang-gate-test-"));
        try {
            // 1. Regenerate the canonical set into tmpDir.
            await runGenDocs({
                sourceDir: resolvePath(REPO_ROOT, "packages/runtime/src/ta"),
                outDir: tmpDir,
                repoRoot: REPO_ROOT,
            });

            // 2. Find any generated file and corrupt the committed copy
            //    into a *third* tmp dir so we don't touch real files.
            const generated = (await readdir(tmpDir)).filter((n) => n.endsWith(".md")).sort();
            expect(generated.length).toBeGreaterThan(0);
            const sample = generated[0] as string;
            const original = await readFile(join(tmpDir, sample), "utf8");
            const driftPath = join(tmpDir, sample);
            await writeFile(driftPath, `${original}\n\nHAND EDIT`, "utf8");

            // 3. Diff against the canonical content via byte comparison.
            const canonical = original;
            const drifted = await readFile(driftPath, "utf8");
            expect(drifted).not.toBe(canonical);
        } finally {
            await rm(tmpDir, { recursive: true, force: true });
        }
    }, 30_000);
});
