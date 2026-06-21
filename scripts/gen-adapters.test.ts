// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ADAPTERS, githubFolder } from "./adapters/registry.js";
import {
    BUNDLE_GITIGNORE,
    GALLERY_HEADER,
    GENERATED_HEADER,
    PKG_NAME_PLACEHOLDER,
    buildBundle,
    generateAdapters,
    renderAllOutputs,
    renderBundleModule,
    renderFullTypesModule,
    renderGallery,
    renderIndexModule,
    renderRegistryModule,
    resolveWorkspaceVersions,
    rewritePackageJson,
} from "./gen-adapters.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(REPO_ROOT, "packages/cli/src/generated/adapters");
const GALLERY_PATH = join(REPO_ROOT, "docs/adapters/gallery.md");

describe("resolveWorkspaceVersions", () => {
    it("reads each chartlang package's published version", async () => {
        const versions = await resolveWorkspaceVersions();
        expect(versions["@invinite-org/chartlang-adapter-kit"]).toMatch(/^\d+\.\d+\.\d+/);
        expect(versions["@invinite-org/chartlang-core"]).toMatch(/^\d+\.\d+\.\d+/);
    });
});

describe("rewritePackageJson", () => {
    const versions = {
        "@invinite-org/chartlang-adapter-kit": "1.3.0",
        "@invinite-org/chartlang-core": "1.2.0",
    } as const;

    it("pins workspace deps to published ranges, swaps the name, keeps private", () => {
        const raw = JSON.stringify({
            name: "chartlang-example-x",
            private: true,
            dependencies: {
                "@invinite-org/chartlang-adapter-kit": "workspace:^",
                konva: "^9",
            },
            devDependencies: {
                "@invinite-org/chartlang-core": "workspace:^",
            },
        });
        const out = rewritePackageJson(raw, versions);
        const pkg = JSON.parse(out);
        expect(pkg.name).toBe(PKG_NAME_PLACEHOLDER);
        expect(pkg.private).toBe(true);
        expect(pkg.dependencies["@invinite-org/chartlang-adapter-kit"]).toBe("^1.3.0");
        expect(pkg.dependencies.konva).toBe("^9");
        expect(pkg.devDependencies["@invinite-org/chartlang-core"]).toBe("^1.2.0");
        expect(out).not.toContain("workspace:");
        expect(out.endsWith("}\n")).toBe(true);
    });

    it("leaves a workspace dep untouched when its version is unknown", () => {
        const raw = JSON.stringify({
            name: "x",
            dependencies: { "@invinite-org/chartlang-unknown": "workspace:^" },
        });
        const pkg = JSON.parse(rewritePackageJson(raw, versions));
        expect(pkg.dependencies["@invinite-org/chartlang-unknown"]).toBe("workspace:^");
    });

    it("tolerates a package.json with no dependency blocks", () => {
        const out = rewritePackageJson(JSON.stringify({ name: "x" }), versions);
        expect(JSON.parse(out).name).toBe(PKG_NAME_PLACEHOLDER);
    });

    it("ignores a non-object dependencies field", () => {
        const out = rewritePackageJson(
            JSON.stringify({ name: "x", dependencies: "nonsense" }),
            versions,
        );
        expect(JSON.parse(out).dependencies).toBe("nonsense");
    });
});

describe("buildBundle", () => {
    it("collects src + README + tsconfig + rewritten package.json + .gitignore", async () => {
        const versions = await resolveWorkspaceVersions();
        const konva = ADAPTERS.find((a) => a.id === "konva");
        if (konva === undefined) throw new Error("konva entry missing");
        const bundle = await buildBundle(konva, versions);

        const keys = Object.keys(bundle.files);
        expect(keys).toContain("package.json");
        expect(keys).toContain("README.md");
        expect(keys).toContain("tsconfig.json");
        expect(keys).toContain(".gitignore");
        expect(keys).toContain("src/index.ts");
        expect(bundle.files[".gitignore"]).toBe(BUNDLE_GITIGNORE);

        // CI-only tests are omitted; unit tests are kept.
        expect(keys).not.toContain("src/integration.test.ts");
        expect(keys).not.toContain("src/conformance.test.ts");
        expect(keys).toContain("src/capabilities.test.ts");

        // Keys are sorted + POSIX (no backslashes), package.json fully rewritten.
        expect(keys).toEqual([...keys].sort());
        for (const key of keys) expect(key).not.toContain("\\");
        expect(bundle.files["package.json"]).not.toContain("workspace:");
        expect(bundle.files["package.json"]).toContain(PKG_NAME_PLACEHOLDER);
    });
});

describe("render helpers", () => {
    it("renderBundleModule prepends the generated + MIT headers and a frozen literal", () => {
        const module = renderBundleModule({ id: "demo", files: { "a.txt": "hi" } });
        expect(module.startsWith(GENERATED_HEADER)).toBe(true);
        expect(module).toContain("Licensed under the MIT License");
        expect(module).toContain('"id": "demo"');
        expect(module).toContain('"a.txt": "hi"');
    });

    it("renderFullTypesModule declares both generated shapes", () => {
        const module = renderFullTypesModule();
        expect(module).toContain("export type GeneratedAdapterBundle");
        expect(module).toContain("export type GeneratedAdapterMeta");
    });

    it("renderRegistryModule emits one meta record per entry with derived links", () => {
        const module = renderRegistryModule(ADAPTERS);
        for (const entry of ADAPTERS) {
            expect(module).toContain(`"id": "${entry.id}"`);
        }
        expect(module).toContain("tree/main/examples/konva-adapter");
    });

    it("renderIndexModule sorts imports by path so the barrel is Biome-clean", () => {
        const module = renderIndexModule(ADAPTERS);
        const importBlock = module.slice(0, module.indexOf("export type"));
        const paths = [...importBlock.matchAll(/from "(\.\/[^"]+)"/g)].map((m) => m[1]);
        expect(paths).toEqual([...paths].sort());
        expect(module).toContain("export const BUNDLED_ADAPTERS");
        // The kebab id is camelised into the import identifier.
        expect(module).toContain("bundle as lightweightChartsBundle");
    });
});

describe("renderGallery (docs gallery)", () => {
    it("starts with the generated marker so hand-edits are obvious + gated", () => {
        expect(renderGallery(ADAPTERS).startsWith(GALLERY_HEADER)).toBe(true);
    });

    it("is deterministic — re-rendering yields identical output", () => {
        expect(renderGallery(ADAPTERS)).toBe(renderGallery(ADAPTERS));
    });

    it("renders every adapter's name, id anchor, install command, and source link", () => {
        const gallery = renderGallery(ADAPTERS);
        for (const entry of ADAPTERS) {
            expect(gallery).toContain(`## ${entry.displayName} {#${entry.id}}`);
            expect(gallery).toContain(`add-adapter ${entry.id}`);
            expect(gallery).toContain(githubFolder(entry));
            expect(gallery).toContain(entry.bestFor);
        }
    });

    it("includes the comparison matrix header + the full drawing-surface cell", () => {
        const gallery = renderGallery(ADAPTERS);
        expect(gallery).toContain(
            "| Adapter | Library | License | Render tech | Drawing surface | ~Bundle | Source |",
        );
        expect(gallery).toContain("Full (63 + all plots)");
    });

    it("documents the hand-maintained ~Bundle field in the FAQ", () => {
        const gallery = renderGallery(ADAPTERS);
        expect(gallery).toContain("approxBundleKb");
        expect(gallery).toContain("hand-maintained");
    });

    it("links canvas2d's committed conformance report, others the conformance docs", () => {
        const gallery = renderGallery(ADAPTERS);
        expect(gallery).toContain(
            "https://github.com/outraday-org/chartlang/blob/main/examples/canvas2d-adapter/CONFORMANCE.md",
        );
        expect(gallery).toContain("[conformance](./conformance.md)");
    });

    it("matches the committed docs/adapters/gallery.md byte-for-byte", async () => {
        const committed = await readFile(GALLERY_PATH, "utf8");
        expect(committed).toBe(renderGallery(ADAPTERS));
    });
});

describe("generateAdapters (gate contract)", () => {
    it("--check passes against the committed bundle + gallery (no drift)", async () => {
        await expect(generateAdapters({ check: true })).resolves.toBeUndefined();
    });

    it("the committed output dir matches renderAllOutputs byte-for-byte", async () => {
        const versions = await resolveWorkspaceVersions();
        const outputs = await renderAllOutputs(ADAPTERS, versions);

        const onDisk = (await readdir(OUT_DIR)).filter((f) => f.endsWith(".ts")).sort();
        expect(onDisk).toEqual(Object.keys(outputs).sort());

        for (const [name, contents] of Object.entries(outputs)) {
            expect(await readFile(join(OUT_DIR, name), "utf8")).toBe(contents);
        }
    });

    it("is deterministic — re-rendering yields identical output", async () => {
        const versions = await resolveWorkspaceVersions();
        const a = await renderAllOutputs(ADAPTERS, versions);
        const b = await renderAllOutputs(ADAPTERS, versions);
        expect(a).toEqual(b);
    });
});
