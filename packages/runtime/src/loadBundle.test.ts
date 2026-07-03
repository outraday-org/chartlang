// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    CompiledScriptBundle,
    CompiledScriptObject,
    ScriptManifest,
} from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { type CompiledModuleExport, buildBundleFromModule } from "./loadBundle.js";

const compute: CompiledScriptObject["compute"] = () => {};

function stubManifest(): ScriptManifest {
    return {
        apiVersion: 1,
        kind: "indicator",
        name: "noop",
        inputs: {},
        capabilities: ["indicators"],
        requestedIntervals: [],
        userPickableInterval: false,
        seriesCapacities: {},
        maxLookback: 0,
    };
}

// Build a `CompiledModuleExport` whose `default.manifest` is whatever shape a
// test needs (some are intentionally malformed to exercise the stub guard).
function moduleWith(
    defaultManifest: unknown,
    extra: Partial<CompiledModuleExport> = {},
): CompiledModuleExport {
    const def =
        defaultManifest === undefined
            ? { compute }
            : { compute, manifest: defaultManifest as ScriptManifest };
    return { default: def as CompiledScriptObject, ...extra } as CompiledModuleExport;
}

describe("buildBundleFromModule", () => {
    it("merges the single-object __manifest sidecar over the default", () => {
        const real: ScriptManifest = { ...stubManifest(), maxLookback: 3, name: "real" };
        const mod = moduleWith(stubManifest(), { __manifest: real });
        const compiled = buildBundleFromModule(mod) as CompiledScriptObject;
        expect(compiled.manifest).toBe(real);
        expect(compiled.compute).toBe(compute);
        expect(Object.isFrozen(compiled)).toBe(true);
    });

    it("passes a legitimately-trivial compiled script (has __manifest) without throwing", () => {
        const trivial = stubManifest();
        const mod = moduleWith(stubManifest(), { __manifest: trivial });
        const compiled = buildBundleFromModule(mod) as CompiledScriptObject;
        expect(compiled.manifest).toBe(trivial);
    });

    it("throws on a stub-shaped default with no __manifest sidecar", () => {
        expect(() => buildBundleFromModule(moduleWith(stubManifest()))).toThrow(/manifest-stub/);
    });

    it("returns the default when it has a rich (non-stub) manifest and no sidecar", () => {
        const rich: ScriptManifest = { ...stubManifest(), maxLookback: 7 };
        const mod = moduleWith(rich);
        expect(buildBundleFromModule(mod)).toBe(mod.default);
    });

    it("does not treat a manifest with plots as a stub", () => {
        const withPlots = {
            ...stubManifest(),
            plots: [{ slotId: "x:1:1#0", kind: "line" }],
        } as unknown as ScriptManifest;
        const mod = moduleWith(withPlots);
        expect(buildBundleFromModule(mod)).toBe(mod.default);
    });

    it("does not treat a manifest with requestedFeeds as a stub", () => {
        const withFeeds = {
            ...stubManifest(),
            requestedFeeds: [{ interval: "1D" }],
        } as unknown as ScriptManifest;
        const mod = moduleWith(withFeeds);
        expect(buildBundleFromModule(mod)).toBe(mod.default);
    });

    it("does not treat a manifest with non-empty seriesCapacities as a stub", () => {
        const withCaps: ScriptManifest = { ...stubManifest(), seriesCapacities: { ohlcv: 4 } };
        const mod = moduleWith(withCaps);
        expect(buildBundleFromModule(mod)).toBe(mod.default);
    });

    it("returns a null-manifest default unchanged (guard treats null as non-stub)", () => {
        const mod = moduleWith(null);
        expect(buildBundleFromModule(mod)).toBe(mod.default);
    });

    it("returns a manifest-less default unchanged", () => {
        const mod = moduleWith(undefined);
        expect(buildBundleFromModule(mod)).toBe(mod.default);
    });

    it("treats a non-object seriesCapacities as non-stub", () => {
        const badCaps = { ...stubManifest(), seriesCapacities: undefined } as unknown;
        const mod = moduleWith(badCaps);
        expect(buildBundleFromModule(mod)).toBe(mod.default);
    });

    it("treats a null seriesCapacities as non-stub", () => {
        const nullCaps = { ...stubManifest(), seriesCapacities: null } as unknown;
        const mod = moduleWith(nullCaps);
        expect(buildBundleFromModule(mod)).toBe(mod.default);
    });

    it("recovers primary + siblings from an array __manifest bundle, skipping every rejected entry", () => {
        const primary: ScriptManifest = {
            ...stubManifest(),
            name: "primary",
            exportName: "default",
        };
        const sibManifest: ScriptManifest = { ...stubManifest(), name: "sib", exportName: "sib" };
        const sibNoName: ScriptManifest = { ...stubManifest(), name: "anon" }; // exportName undefined
        const sibReserved: ScriptManifest = {
            ...stubManifest(),
            name: "dflt",
            exportName: "default",
        };
        const sibNonObject: ScriptManifest = { ...stubManifest(), name: "num", exportName: "num" };
        const sibNull: ScriptManifest = { ...stubManifest(), name: "nul", exportName: "nul" };
        const sibNoCompute: ScriptManifest = { ...stubManifest(), name: "noc", exportName: "noc" };
        const sibNoManifest: ScriptManifest = { ...stubManifest(), name: "nom", exportName: "nom" };
        const sib: CompiledScriptObject = { compute, manifest: sibManifest };
        const mod: CompiledModuleExport = {
            default: { compute, manifest: primary } as CompiledScriptObject,
            __manifest: [
                primary,
                sibManifest,
                sibNoName,
                sibReserved,
                sibNonObject,
                sibNull,
                sibNoCompute,
                sibNoManifest,
            ],
            sib,
            num: 42, // non-object → rejected
            nul: null, // null → rejected
            noc: { manifest: sibNoCompute }, // no compute → rejected
            nom: { compute }, // no manifest → rejected
        } as CompiledModuleExport;
        const bundle = buildBundleFromModule(mod) as CompiledScriptBundle;
        expect(bundle.primary.manifest).toBe(primary);
        expect(bundle.siblings).toHaveLength(1);
        expect(bundle.siblings[0]?.exportName).toBe("sib");
        expect(bundle.siblings[0]?.compiled).toBe(sib);
    });

    it("recovers dependencies for a single-script bundle with private deps", () => {
        const primary = stubManifest();
        const depA: CompiledScriptObject = { compute, manifest: stubManifest() };
        const depB: CompiledScriptObject = { compute, manifest: stubManifest() };
        const mod: CompiledModuleExport = {
            default: { compute, manifest: primary } as CompiledScriptObject,
            __manifest: primary,
            __dependencies: [
                { localId: "a", compiled: depA },
                { localId: "b", compiled: depB, inputOverrides: { len: 20 } },
            ],
        } as CompiledModuleExport;
        const bundle = buildBundleFromModule(mod) as CompiledScriptBundle;
        expect(bundle.siblings).toHaveLength(0);
        expect(bundle.dependencies).toHaveLength(2);
        expect(bundle.dependencies[0]).toEqual({ localId: "a", compiled: depA });
        expect(bundle.dependencies[1]).toEqual({
            localId: "b",
            compiled: depB,
            inputOverrides: { len: 20 },
        });
    });
});
