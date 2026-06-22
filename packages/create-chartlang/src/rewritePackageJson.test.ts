// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { type RewriteOpts, rewriteStarterPackageJson } from "./rewritePackageJson.js";

const STARTER = JSON.stringify({
    name: "chartlang-react-starter",
    scripts: {
        dev: "vite dev",
        e2e: "playwright test",
        "e2e:install": "playwright install --with-deps chromium",
    },
    dependencies: {
        "@invinite-org/chartlang-core": "workspace:*",
        "@invinite-org/chartlang-editor": "workspace:*",
        "chartlang-example-echarts-adapter": "workspace:*",
        echarts: "^5",
        react: "^19",
    },
    devDependencies: {
        "@invinite-org/chartlang-compiler": "workspace:*",
        "@playwright/test": "^1.45.0",
        "chartlang-example-konva-adapter": "workspace:*",
        konva: "^9",
        "lightweight-charts": "^5",
        uplot: "^1",
        vite: "^8",
    },
});

function baseOpts(overrides: Partial<RewriteOpts> = {}): RewriteOpts {
    return {
        source: STARTER,
        projectName: "my-app",
        libraryId: "echarts",
        chartLibrary: "echarts",
        chartLibraryRange: "^5",
        vendoredAdapterName: "@local/echarts-adapter",
        vendoredAdapterSpec: "file:./vendor/echarts-adapter",
        bundleVersions: { "@invinite-org/chartlang-core": "^1.2.0" },
        ...overrides,
    };
}

function parse(text: string): {
    name: string;
    scripts?: Record<string, string>;
    dependencies: Record<string, string>;
    devDependencies?: Record<string, string>;
} {
    return JSON.parse(text) as {
        name: string;
        scripts?: Record<string, string>;
        dependencies: Record<string, string>;
        devDependencies?: Record<string, string>;
    };
}

describe("rewriteStarterPackageJson", () => {
    it("stamps the project name", () => {
        expect(parse(rewriteStarterPackageJson(baseOpts())).name).toBe("my-app");
    });

    it("resolves chartlang deps from the bundle first, then the baked manifest", () => {
        const pkg = parse(rewriteStarterPackageJson(baseOpts()));
        // core is in bundleVersions → that range wins.
        expect(pkg.dependencies["@invinite-org/chartlang-core"]).toBe("^1.2.0");
        // editor is not in the bundle → falls back to CHARTLANG_VERSIONS.
        expect(pkg.dependencies["@invinite-org/chartlang-editor"]).toMatch(/^\^/);
        // compiler (devDep) also falls back to the manifest.
        expect(pkg.devDependencies?.["@invinite-org/chartlang-compiler"]).toMatch(/^\^/);
    });

    it("drops every example-adapter dep (deps + devDeps)", () => {
        const pkg = parse(rewriteStarterPackageJson(baseOpts()));
        expect(pkg.dependencies["chartlang-example-echarts-adapter"]).toBeUndefined();
        expect(pkg.devDependencies?.["chartlang-example-konva-adapter"]).toBeUndefined();
    });

    it("wires the vendored adapter + chart library, leaving non-chartlang deps intact", () => {
        const pkg = parse(rewriteStarterPackageJson(baseOpts()));
        expect(pkg.dependencies["@local/echarts-adapter"]).toBe("file:./vendor/echarts-adapter");
        expect(pkg.dependencies.echarts).toBe("^5");
        expect(pkg.dependencies.react).toBe("^19");
        expect(pkg.devDependencies?.vite).toBe("^8");
    });

    it("drops every unused matrix chart lib and re-adds only the chosen one once", () => {
        const pkg = parse(rewriteStarterPackageJson(baseOpts()));
        // Non-chosen matrix libs (devDeps) are dropped entirely.
        expect(pkg.devDependencies?.konva).toBeUndefined();
        expect(pkg.devDependencies?.["lightweight-charts"]).toBeUndefined();
        expect(pkg.devDependencies?.uplot).toBeUndefined();
        // The chosen lib (echarts) is present exactly once, at its registry range.
        expect(pkg.dependencies.echarts).toBe("^5");
        expect(pkg.devDependencies?.echarts).toBeUndefined();
    });

    it("drops all matrix chart libs for the no-library (canvas2d) case", () => {
        const pkg = parse(
            rewriteStarterPackageJson(
                baseOpts({
                    libraryId: "canvas2d",
                    chartLibrary: "",
                    chartLibraryRange: "(built-in)",
                }),
            ),
        );
        expect(pkg.dependencies.echarts).toBeUndefined();
        expect(pkg.devDependencies?.konva).toBeUndefined();
        expect(pkg.devDependencies?.["lightweight-charts"]).toBeUndefined();
        expect(pkg.devDependencies?.uplot).toBeUndefined();
    });

    it("drops the e2e scripts + Playwright runner (stripped with tests/)", () => {
        const pkg = parse(rewriteStarterPackageJson(baseOpts()));
        expect(pkg.scripts?.e2e).toBeUndefined();
        expect(pkg.scripts?.["e2e:install"]).toBeUndefined();
        // Non-e2e scripts + devDeps are left intact.
        expect(pkg.scripts?.dev).toBe("vite dev");
        expect(pkg.devDependencies?.["@playwright/test"]).toBeUndefined();
        expect(pkg.devDependencies?.vite).toBe("^8");
    });

    it("omits a chart-library dep for the no-library (canvas2d) case", () => {
        const pkg = parse(
            rewriteStarterPackageJson(
                baseOpts({
                    libraryId: "canvas2d",
                    chartLibrary: "",
                    chartLibraryRange: "(built-in)",
                }),
            ),
        );
        expect(pkg.dependencies["(built-in)"]).toBeUndefined();
    });

    it("handles a package.json with no devDependencies block", () => {
        const minimal = JSON.stringify({ name: "x", dependencies: {} });
        const pkg = parse(rewriteStarterPackageJson(baseOpts({ source: minimal })));
        expect(pkg.devDependencies).toBeUndefined();
    });

    it("handles a package.json with no dependencies block", () => {
        const minimal = JSON.stringify({ name: "x" });
        const pkg = parse(rewriteStarterPackageJson(baseOpts({ source: minimal })));
        expect(pkg.dependencies["@local/echarts-adapter"]).toBe("file:./vendor/echarts-adapter");
    });

    it("emits no workspace: range anywhere", () => {
        expect(rewriteStarterPackageJson(baseOpts())).not.toContain("workspace:");
    });

    it("throws if a non-chartlang dep still carries a workspace: range", () => {
        // The chartlang/example rewrites can't leave a workspace token, so the
        // final leak-guard only fires on an unexpected non-chartlang workspace
        // dep — assert it does, loudly.
        const src = JSON.stringify({
            name: "x",
            dependencies: { "some-internal-tool": "workspace:*" },
        });
        expect(() => rewriteStarterPackageJson(baseOpts({ source: src }))).toThrow(
            /still contains a workspace: dependency/,
        );
    });

    it("throws when a chartlang dep has no known published version", () => {
        const src = JSON.stringify({
            name: "x",
            dependencies: { "@invinite-org/chartlang-unknown": "workspace:*" },
        });
        expect(() =>
            rewriteStarterPackageJson(baseOpts({ source: src, bundleVersions: {} })),
        ).toThrow(/no published version known/);
    });
});
