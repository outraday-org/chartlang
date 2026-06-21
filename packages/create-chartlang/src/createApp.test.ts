// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GeneratedAdapterMeta } from "@invinite-org/chartlang-cli";
import {
    type CloneRequest,
    type CreateChartlangDeps,
    STARTER_SOURCE_BASE,
    bundleChartlangVersions,
    defaultDeps,
    renderLibraryChoices,
    resolveAdapter,
    runCreateChartlang,
} from "./createApp.js";
import { SEAM_IDS } from "./seamTemplates.js";

const STARTER_PKG = JSON.stringify(
    {
        name: "chartlang-react-starter",
        private: true,
        dependencies: {
            "@invinite-org/chartlang-core": "workspace:*",
            "@invinite-org/chartlang-editor": "workspace:*",
            "@invinite-org/chartlang-host-worker": "workspace:*",
            "@invinite-org/chartlang-language-service": "workspace:*",
            "@invinite-org/chartlang-adapter-kit": "workspace:*",
            "chartlang-example-echarts-adapter": "workspace:*",
            echarts: "^5",
            react: "^19",
        },
        devDependencies: {
            "@invinite-org/chartlang-compiler": "workspace:*",
            "chartlang-example-canvas2d-adapter": "workspace:*",
            "chartlang-example-konva-adapter": "workspace:*",
            "chartlang-example-lightweight-charts-adapter": "workspace:*",
            "chartlang-example-uplot-adapter": "workspace:*",
            vite: "^8",
        },
    },
    null,
    4,
);

/** A clone that writes the fixture starter tree (incl. repo artefacts to strip). */
function fixtureClone(envExample = "DATABASE_URL=file:./data/starter.db\nEODDATA_API_KEY=\n") {
    return async ({ dir }: CloneRequest): Promise<void> => {
        await mkdir(join(dir, "src", "lib", "chart"), { recursive: true });
        await writeFile(join(dir, "package.json"), STARTER_PKG, "utf8");
        await writeFile(
            join(dir, "src", "lib", "chart", "activeAdapter.ts"),
            "// placeholder echarts seam\n",
            "utf8",
        );
        if (envExample !== "") {
            await writeFile(join(dir, ".env.example"), envExample, "utf8");
        }
        // Repo-internal artefacts that the installer must strip.
        await writeFile(join(dir, "CLAUDE.md"), "# starter contract\n", "utf8");
        await mkdir(join(dir, "tests"), { recursive: true });
        await writeFile(join(dir, "tests", "compile.spec.ts"), "// e2e\n", "utf8");
        await writeFile(join(dir, "playwright.config.ts"), "// references tests/\n", "utf8");
        await mkdir(join(dir, ".github"), { recursive: true });
        await writeFile(join(dir, ".github", "ci.yml"), "ci\n", "utf8");
    };
}

type Capture = { out: string; err: string };

function makeDeps(over: Partial<CreateChartlangDeps> & { cap?: Capture; answer?: string } = {}): {
    deps: CreateChartlangDeps;
    cap: Capture;
    install: ReturnType<typeof vi.fn>;
} {
    const cap = over.cap ?? { out: "", err: "" };
    const install = vi.fn(async () => {});
    const writeTo =
        (key: "out" | "err") =>
        (s: string): boolean => {
            cap[key] += s;
            return true;
        };
    const deps: CreateChartlangDeps = {
        stdout: { write: writeTo("out") } as NodeJS.WritableStream,
        stderr: { write: writeTo("err") } as NodeJS.WritableStream,
        isTTY: over.isTTY ?? false,
        createPrompter:
            over.createPrompter ??
            (() => ({ question: async () => over.answer ?? "", close: () => {} })),
        cloneStarter: over.cloneStarter ?? fixtureClone(),
        runInstall: over.runInstall ?? install,
    };
    return { deps, cap, install };
}

let root: string;

beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "create-chartlang-"));
    process.exitCode = undefined;
});

afterEach(async () => {
    await rm(root, { recursive: true, force: true });
    vi.restoreAllMocks();
    process.exitCode = undefined;
});

async function exists(path: string): Promise<boolean> {
    try {
        await stat(path);
        return true;
    } catch {
        return false;
    }
}

describe("renderLibraryChoices", () => {
    it("lists echarts first and marks the default", () => {
        const text = renderLibraryChoices([
            {
                id: "canvas2d",
                displayName: "Canvas 2D",
                library: "(none)",
            } as unknown as GeneratedAdapterMeta,
            {
                id: "echarts",
                displayName: "ECharts",
                library: "echarts",
            } as unknown as GeneratedAdapterMeta,
        ]);
        const echartsLine = text.indexOf("echarts");
        const canvasLine = text.indexOf("canvas2d");
        expect(echartsLine).toBeLessThan(canvasLine);
        expect(text).toContain("(default)");
        expect(text).toContain("no runtime dep");
    });
});

describe("runCreateChartlang", () => {
    it("scaffolds each library: vendors adapter, rewrites seam, no workspace deps", async () => {
        for (const id of SEAM_IDS) {
            const dir = join(root, `app-${id}`);
            const { deps } = makeDeps();
            await runCreateChartlang([dir, "--library", id, "--no-install"], deps);
            expect(process.exitCode).toBeUndefined();

            // Vendored adapter present + named locally.
            const vendoredPkg = JSON.parse(
                await readFile(join(dir, "vendor", `${id}-adapter`, "package.json"), "utf8"),
            ) as { name: string };
            expect(vendoredPkg.name).toBe(`@local/${id}-adapter`);

            // Seam rewritten to import the vendored adapter.
            const seam = await readFile(
                join(dir, "src", "lib", "chart", "activeAdapter.ts"),
                "utf8",
            );
            expect(seam).toContain(`from "@local/${id}-adapter"`);
            expect(seam).toContain("createActiveAdapter");

            // package.json: no workspace, vendored adapter wired in.
            const pkgText = await readFile(join(dir, "package.json"), "utf8");
            expect(pkgText).not.toContain("workspace:");
            const pkg = JSON.parse(pkgText) as { dependencies: Record<string, string> };
            expect(pkg.dependencies[`@local/${id}-adapter`]).toBe(`file:./vendor/${id}-adapter`);

            // .env written.
            expect(await exists(join(dir, ".env"))).toBe(true);
        }
    });

    it("adds the chart-library dep for a library that needs one", async () => {
        const dir = join(root, "echarts-app");
        const { deps } = makeDeps();
        await runCreateChartlang([dir, "--library", "echarts", "--no-install"], deps);
        const pkg = JSON.parse(await readFile(join(dir, "package.json"), "utf8")) as {
            dependencies: Record<string, string>;
        };
        expect(pkg.dependencies.echarts).toBe("^5");
    });

    it("strips repo-internal artefacts (CLAUDE.md / tests / .github / playwright.config.ts)", async () => {
        const dir = join(root, "clean-app");
        const { deps } = makeDeps();
        await runCreateChartlang([dir, "--library", "echarts", "--no-install"], deps);
        expect(await exists(join(dir, "CLAUDE.md"))).toBe(false);
        expect(await exists(join(dir, "tests"))).toBe(false);
        expect(await exists(join(dir, ".github"))).toBe(false);
        expect(await exists(join(dir, ".changeset"))).toBe(false);
        expect(await exists(join(dir, "playwright.config.ts"))).toBe(false);
    });

    it("copies .env.example to .env when present", async () => {
        const dir = join(root, "env-app");
        const { deps } = makeDeps();
        await runCreateChartlang([dir, "--library", "echarts", "--no-install"], deps);
        const env = await readFile(join(dir, ".env"), "utf8");
        expect(env).toContain("EODDATA_API_KEY=");
        expect(env).toContain("DATABASE_URL=file:./data/starter.db");
    });

    it("falls back to a baked .env when the clone has no .env.example", async () => {
        const dir = join(root, "no-example-app");
        const { deps } = makeDeps({ cloneStarter: fixtureClone("") });
        await runCreateChartlang([dir, "--library", "echarts", "--no-install"], deps);
        const env = await readFile(join(dir, ".env"), "utf8");
        expect(env).toContain("EODDATA_API_KEY=");
        expect(env).toContain("eoddata.com");
    });

    it("defaults to echarts with --yes and no --library", async () => {
        const dir = join(root, "default-app");
        const { deps } = makeDeps();
        await runCreateChartlang([dir, "--yes", "--no-install"], deps);
        const seam = await readFile(join(dir, "src", "lib", "chart", "activeAdapter.ts"), "utf8");
        expect(seam).toContain('ACTIVE_ADAPTER_ID = "echarts"');
        expect(await exists(join(dir, "vendor", "echarts-adapter"))).toBe(true);
    });

    it("clones from the pinned github source", async () => {
        const dir = join(root, "src-app");
        const seen: string[] = [];
        const { deps } = makeDeps({
            cloneStarter: async (req) => {
                seen.push(req.source);
                await fixtureClone()(req);
            },
        });
        await runCreateChartlang([dir, "--yes", "--no-install"], deps);
        expect(seen[0]?.startsWith(STARTER_SOURCE_BASE)).toBe(true);
        expect(seen[0]).toContain("#");
    });

    it("prompts on a TTY and uses the typed answer", async () => {
        const dir = join(root, "prompt-app");
        const { deps, cap } = makeDeps({ isTTY: true, answer: "uplot" });
        await runCreateChartlang([dir, "--no-install"], deps);
        expect(cap.out).toContain("Choose a chart library");
        const seam = await readFile(join(dir, "src", "lib", "chart", "activeAdapter.ts"), "utf8");
        expect(seam).toContain('ACTIVE_ADAPTER_ID = "uplot"');
    });

    it("prompts on a TTY and defaults to echarts on an empty answer", async () => {
        const dir = join(root, "prompt-default-app");
        const { deps } = makeDeps({ isTTY: true, answer: "" });
        await runCreateChartlang([dir, "--no-install"], deps);
        const seam = await readFile(join(dir, "src", "lib", "chart", "activeAdapter.ts"), "utf8");
        expect(seam).toContain('ACTIVE_ADAPTER_ID = "echarts"');
    });

    it("errors + exits 1 on an unknown --library", async () => {
        const dir = join(root, "bad-lib");
        const { deps, cap } = makeDeps();
        await runCreateChartlang([dir, "--library", "highcharts", "--no-install"], deps);
        expect(process.exitCode).toBe(1);
        expect(cap.err).toContain('unknown --library "highcharts"');
        expect(await exists(dir)).toBe(false);
    });

    it("errors + exits 1 on an unknown prompted library", async () => {
        const dir = join(root, "bad-prompt");
        const { deps, cap } = makeDeps({ isTTY: true, answer: "nope" });
        await runCreateChartlang([dir, "--no-install"], deps);
        expect(process.exitCode).toBe(1);
        expect(cap.err).toContain('unknown library "nope"');
    });

    it("errors + exits 1 on an invalid --pm", async () => {
        const dir = join(root, "bad-pm");
        const { deps, cap } = makeDeps();
        await runCreateChartlang([dir, "--pm", "rush", "--no-install"], deps);
        expect(process.exitCode).toBe(1);
        expect(cap.err).toContain('invalid --pm "rush"');
    });

    it("refuses a non-empty target dir without --yes", async () => {
        const dir = join(root, "occupied");
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, "keep.txt"), "x", "utf8");
        const { deps, cap } = makeDeps();
        await runCreateChartlang([dir, "--library", "echarts", "--no-install"], deps);
        expect(process.exitCode).toBe(1);
        expect(cap.err).toContain("target directory not empty");
    });

    it("overwrites a non-empty dir with --yes", async () => {
        const dir = join(root, "occupied-yes");
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, "keep.txt"), "x", "utf8");
        const { deps } = makeDeps();
        await runCreateChartlang([dir, "--library", "echarts", "--yes", "--no-install"], deps);
        expect(process.exitCode).toBeUndefined();
        expect(await exists(join(dir, "package.json"))).toBe(true);
    });

    it("runs install by default and reports it in next steps", async () => {
        const dir = join(root, "install-app");
        const { deps, cap, install } = makeDeps();
        await runCreateChartlang([dir, "--library", "echarts", "--pm", "pnpm"], deps);
        expect(install).toHaveBeenCalledWith("pnpm", dir);
        expect(cap.out).toContain("pnpm run dev");
        expect(cap.out).not.toContain("pnpm install");
    });

    it("skips install with --no-install and prints the install step", async () => {
        const dir = join(root, "noinstall-app");
        const { deps, cap, install } = makeDeps();
        await runCreateChartlang([dir, "--library", "echarts", "--no-install"], deps);
        expect(install).not.toHaveBeenCalled();
        expect(cap.out).toContain("npm install");
    });

    it("defaults the target dir to ./chartlang-starter", async () => {
        const cwd = process.cwd();
        const sandbox = join(root, "cwd");
        await mkdir(sandbox, { recursive: true });
        process.chdir(sandbox);
        try {
            const { deps } = makeDeps();
            await runCreateChartlang(["--yes", "--no-install"], deps);
            expect(await exists(join(sandbox, "chartlang-starter", "package.json"))).toBe(true);
        } finally {
            process.chdir(cwd);
        }
    });

    it("resolves an absolute target dir as-is", async () => {
        const dir = join(root, "abs-app");
        const { deps } = makeDeps();
        await runCreateChartlang([dir, "--yes", "--no-install"], deps);
        expect(await exists(join(dir, "package.json"))).toBe(true);
    });
});

describe("resolveAdapter", () => {
    it("resolves every bundled SeamId (parity with the generated set)", () => {
        for (const id of SEAM_IDS) {
            const { bundle, meta } = resolveAdapter(id);
            expect(bundle.id).toBe(id);
            expect(meta.id).toBe(id);
        }
    });

    it("throws on an id with no bundle/registry entry", () => {
        expect(() => resolveAdapter("highcharts")).toThrow(/no bundle\/registry entry/);
    });
});

describe("bundleChartlangVersions", () => {
    it("harvests chartlang ranges from deps + devDeps", () => {
        const map = bundleChartlangVersions({
            id: "x",
            files: {
                "package.json": JSON.stringify({
                    dependencies: { "@invinite-org/chartlang-core": "^1.2.0", echarts: "^5" },
                    devDependencies: { "@invinite-org/chartlang-compiler": "^1.3.0" },
                }),
            },
        });
        expect(map).toEqual({
            "@invinite-org/chartlang-core": "^1.2.0",
            "@invinite-org/chartlang-compiler": "^1.3.0",
        });
    });

    it("returns an empty map when the bundle has no package.json", () => {
        expect(bundleChartlangVersions({ id: "x", files: {} })).toEqual({});
    });
});

describe("defaultDeps", () => {
    it("wires the real process streams + a prompter", () => {
        const deps = defaultDeps({ cloneStarter: async () => {}, runInstall: async () => {} });
        expect(deps.stdout).toBe(process.stdout);
        expect(deps.stderr).toBe(process.stderr);
        expect(typeof deps.isTTY).toBe("boolean");
        deps.createPrompter().close();
    });
});
