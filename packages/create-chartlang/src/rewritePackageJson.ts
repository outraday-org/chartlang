// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { CHARTLANG_VERSIONS } from "./chartlangVersions.js";
import type { SeamId } from "./seamTemplates.js";

const WORKSPACE_RANGE = "workspace:*";
const CHARTLANG_SCOPE = "@invinite-org/chartlang-";
const EXAMPLE_ADAPTER_PREFIX = "chartlang-example-";
const EXAMPLE_ADAPTER_SUFFIX = "-adapter";

/**
 * Options for {@link rewriteStarterPackageJson}.
 *
 * @since 0.1
 * @stable
 * @example
 *     import type { RewriteOpts } from "create-chartlang";
 *     declare const opts: RewriteOpts;
 *     void opts.projectName;
 */
export type RewriteOpts = Readonly<{
    /** The cloned starter's raw `package.json` text. */
    source: string;
    /** The project name to stamp into the rewritten `package.json`. */
    projectName: string;
    /** The chosen chart-library adapter id. */
    libraryId: SeamId;
    /** The npm chart library the chosen adapter depends on (empty for canvas2d). */
    chartLibrary: string;
    /** The semver range for {@link chartLibrary} (from the adapter registry). */
    chartLibraryRange: string;
    /** The local package name the chosen adapter was vendored under. */
    vendoredAdapterName: string;
    /** The dependency value for the vendored adapter (e.g. `file:./vendor/echarts-adapter`). */
    vendoredAdapterSpec: string;
    /**
     * Published `^`-ranges harvested from the vendored bundle's own (already
     * generator-pinned) `package.json` deps. Preferred over the baked
     * {@link CHARTLANG_VERSIONS} manifest for the packages it covers.
     */
    bundleVersions: Readonly<Record<string, string>>;
}>;

type DepMap = Record<string, string>;

function isExampleAdapterName(name: string): boolean {
    return name.startsWith(EXAMPLE_ADAPTER_PREFIX) && name.endsWith(EXAMPLE_ADAPTER_SUFFIX);
}

function resolveChartlangRange(
    name: string,
    bundleVersions: Readonly<Record<string, string>>,
): string {
    const fromBundle = bundleVersions[name];
    if (fromBundle !== undefined) {
        return fromBundle;
    }
    const fromManifest = CHARTLANG_VERSIONS[name];
    if (fromManifest === undefined) {
        throw new Error(
            `no published version known for "${name}" — add it to CHARTLANG_VERSIONS in create-chartlang`,
        );
    }
    return fromManifest;
}

/**
 * Rewrite ONE dependency block (deps or devDeps): replace every
 * `@invinite-org/chartlang-*: workspace:*` with its published `^`-range, drop
 * every `chartlang-example-*-adapter: workspace:*` (the chosen one is vendored
 * locally), and leave non-chartlang deps untouched.
 */
function rewriteBlock(
    block: DepMap | undefined,
    bundleVersions: Readonly<Record<string, string>>,
): DepMap | undefined {
    if (block === undefined) {
        return undefined;
    }
    const out: DepMap = {};
    for (const [name, range] of Object.entries(block)) {
        if (isExampleAdapterName(name)) {
            // The chosen adapter is vendored; the other examples are not shipped.
            continue;
        }
        if (name.startsWith(CHARTLANG_SCOPE) && range === WORKSPACE_RANGE) {
            out[name] = resolveChartlangRange(name, bundleVersions);
            continue;
        }
        out[name] = range;
    }
    return out;
}

// The e2e suite (Playwright + `tests/` + `playwright.config.ts`) is stripped
// from the clone, so its scripts + runner devDependency are dropped too —
// they would otherwise reference deleted files.
const E2E_SCRIPTS = ["e2e", "e2e:install"] as const;
const E2E_DEV_DEPS = ["@playwright/test"] as const;

/** Return a copy of `block` without the named keys (or `undefined` as-is). */
function omitKeys(block: DepMap | undefined, keys: ReadonlyArray<string>): DepMap | undefined {
    if (block === undefined) {
        return undefined;
    }
    const out: DepMap = {};
    for (const [name, value] of Object.entries(block)) {
        if (keys.includes(name)) {
            continue;
        }
        out[name] = value;
    }
    return out;
}

type PackageJson = {
    name?: string;
    scripts?: DepMap;
    dependencies?: DepMap;
    devDependencies?: DepMap;
    [key: string]: unknown;
};

/**
 * Rewrite the cloned starter's `package.json` for a standalone, installable
 * project: stamp the project name, replace every `workspace:*` chartlang dep
 * with its published `^`-range, drop the unused example-adapter deps, wire the
 * vendored adapter as a local `file:` dep, and add the chosen chart library +
 * range. The result contains NO `workspace:` ranges (asserted) so it resolves
 * straight from npm.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { rewriteStarterPackageJson } from "create-chartlang";
 *     const next = rewriteStarterPackageJson({
 *         source: '{"name":"x","dependencies":{}}',
 *         projectName: "my-app",
 *         libraryId: "echarts",
 *         chartLibrary: "echarts",
 *         chartLibraryRange: "^5",
 *         vendoredAdapterName: "@local/echarts-adapter",
 *         vendoredAdapterSpec: "file:./vendor/echarts-adapter",
 *         bundleVersions: {},
 *     });
 *     void next;
 */
export function rewriteStarterPackageJson(opts: RewriteOpts): string {
    const parsed = JSON.parse(opts.source) as PackageJson;

    parsed.name = opts.projectName;

    const deps = rewriteBlock(parsed.dependencies, opts.bundleVersions) ?? {};
    parsed.dependencies = deps;
    const devDeps = omitKeys(
        rewriteBlock(parsed.devDependencies, opts.bundleVersions),
        E2E_DEV_DEPS,
    );
    if (devDeps !== undefined) {
        parsed.devDependencies = devDeps;
    }

    const scripts = omitKeys(parsed.scripts, E2E_SCRIPTS);
    if (scripts !== undefined) {
        parsed.scripts = scripts;
    }

    // Wire the vendored adapter + its chart library as runtime deps.
    deps[opts.vendoredAdapterName] = opts.vendoredAdapterSpec;
    if (opts.chartLibrary !== "") {
        deps[opts.chartLibrary] = opts.chartLibraryRange;
    }

    const out = `${JSON.stringify(parsed, null, 4)}\n`;
    if (out.includes(WORKSPACE_RANGE)) {
        throw new Error("rewritten package.json still contains a workspace: dependency");
    }
    return out;
}
