// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runScaffoldAdapter } from "./scaffoldAdapter";

describe("runScaffoldAdapter", () => {
    let workspace: string;
    let stdoutChunks: string[];
    let stderrChunks: string[];
    let stdoutSpy: ReturnType<typeof vi.spyOn>;
    let stderrSpy: ReturnType<typeof vi.spyOn>;
    let priorExitCode: number | undefined;
    let priorCwd: string;

    beforeEach(async () => {
        workspace = await mkdtemp(join(tmpdir(), "chartlang-cli-scaffold-"));
        stdoutChunks = [];
        stderrChunks = [];
        stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
            stdoutChunks.push(typeof chunk === "string" ? chunk : chunk.toString());
            return true;
        });
        stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
            stderrChunks.push(typeof chunk === "string" ? chunk : chunk.toString());
            return true;
        });
        priorExitCode = process.exitCode;
        process.exitCode = undefined;
        priorCwd = process.cwd();
    });

    afterEach(async () => {
        process.chdir(priorCwd);
        stdoutSpy.mockRestore();
        stderrSpy.mockRestore();
        process.exitCode = priorExitCode;
        await rm(workspace, { recursive: true, force: true });
    });

    it("scaffolds all eight files into the supplied target", async () => {
        const target = join(workspace, "demo-adapter");
        await runScaffoldAdapter(["demo-adapter", "--target", target]);

        await expect(stat(join(target, "package.json"))).resolves.toBeTruthy();
        await expect(stat(join(target, "tsconfig.json"))).resolves.toBeTruthy();
        await expect(stat(join(target, "src", "index.ts"))).resolves.toBeTruthy();
        await expect(stat(join(target, "src", "index.test.ts"))).resolves.toBeTruthy();
        await expect(stat(join(target, "src", "conformance.test.ts"))).resolves.toBeTruthy();
        await expect(stat(join(target, "scripts", "conformance-report.ts"))).resolves.toBeTruthy();
        await expect(stat(join(target, "README.md"))).resolves.toBeTruthy();
        await expect(stat(join(target, ".gitignore"))).resolves.toBeTruthy();

        const pkg = JSON.parse(await readFile(join(target, "package.json"), "utf8"));
        expect(pkg.name).toBe("chartlang-adapter-demo-adapter");
        expect(pkg.private).toBe(true);
        expect(pkg.scripts["conformance:report"]).toBe("tsx scripts/conformance-report.ts");
        expect(pkg.devDependencies["@invinite-org/chartlang-conformance"]).toBe("^1.0.0");

        const indexTs = await readFile(join(target, "src", "index.ts"), "utf8");
        expect(indexTs).toMatch(/defineAdapter/);
        expect(indexTs).toMatch(/id: "demo-adapter"/);
        expect(indexTs).toMatch(/export default adapter/);

        const conformanceTestTs = await readFile(
            join(target, "src", "conformance.test.ts"),
            "utf8",
        );
        expect(conformanceTestTs).toMatch(/runConformanceSuite/);
        expect(conformanceTestTs).toMatch(/import adapter from "\.\/index\.js"/);

        const conformanceReportTs = await readFile(
            join(target, "scripts", "conformance-report.ts"),
            "utf8",
        );
        expect(conformanceReportTs).toMatch(/renderConformanceMarkdown/);
        expect(conformanceReportTs).toMatch(/conformance-report\.json/);

        expect(stdoutChunks.join("")).toMatch(/scaffolded chartlang-adapter-demo-adapter at /);
    });

    it("defaults --target to ./<name> resolved against cwd", async () => {
        process.chdir(workspace);
        await runScaffoldAdapter(["my-adapter"]);

        await expect(stat(join(workspace, "my-adapter", "package.json"))).resolves.toBeTruthy();
    });

    it("accepts an absolute --target path", async () => {
        const target = join(workspace, "absolute-target");
        await runScaffoldAdapter(["abs-name", "--target", target]);

        await expect(stat(join(target, "package.json"))).resolves.toBeTruthy();
    });

    it("rejects names containing uppercase letters", async () => {
        await runScaffoldAdapter(["BadName", "--target", join(workspace, "bad")]);

        expect(process.exitCode).toBe(1);
        expect(stderrChunks.join("")).toMatch(/invalid adapter name "BadName"/);
        await expect(stat(join(workspace, "bad"))).rejects.toThrow();
    });

    it("rejects names with a leading digit", async () => {
        await runScaffoldAdapter(["1bad", "--target", join(workspace, "bad")]);

        expect(process.exitCode).toBe(1);
        expect(stderrChunks.join("")).toMatch(/invalid adapter name "1bad"/);
    });

    it("rejects names with underscores", async () => {
        await runScaffoldAdapter(["bad_name", "--target", join(workspace, "bad")]);

        expect(process.exitCode).toBe(1);
        expect(stderrChunks.join("")).toMatch(/invalid adapter name "bad_name"/);
    });

    it("refuses to overwrite a non-empty target", async () => {
        const target = join(workspace, "existing");
        await mkdir(target, { recursive: true });
        await writeFile(join(target, "marker"), "x", "utf8");

        await runScaffoldAdapter(["demo", "--target", target]);

        expect(process.exitCode).toBe(1);
        expect(stderrChunks.join("")).toMatch(/target directory not empty/);
    });

    it("allows scaffolding into an empty existing directory", async () => {
        const target = join(workspace, "empty");
        await mkdir(target, { recursive: true });

        await runScaffoldAdapter(["demo", "--target", target]);

        await expect(stat(join(target, "package.json"))).resolves.toBeTruthy();
    });

    it("errors when no name positional is provided", async () => {
        await runScaffoldAdapter([]);

        expect(process.exitCode).toBe(1);
        expect(stderrChunks.join("")).toMatch(/requires a name positional/);
    });

    it("prints help with --help and does not scaffold", async () => {
        await runScaffoldAdapter(["--help"]);

        expect(stdoutChunks.join("")).toMatch(/chartlang — script compiler/);
    });
});
