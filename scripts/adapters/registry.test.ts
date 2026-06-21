// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ADAPTERS, REPO_URL, githubFolder } from "./registry.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("adapters registry", () => {
    it("declares the five full-surface example adapters", () => {
        expect(ADAPTERS.map((a) => a.id)).toEqual([
            "canvas2d",
            "echarts",
            "konva",
            "lightweight-charts",
            "uplot",
        ]);
    });

    it("points every entry at an existing examples/<id>-adapter folder", () => {
        for (const entry of ADAPTERS) {
            expect(entry.exampleDir).toBe(`examples/${entry.id}-adapter`);
            expect(existsSync(join(REPO_ROOT, entry.exampleDir, "package.json"))).toBe(true);
        }
    });

    it("marks every adapter full-surface with a positive bundle size", () => {
        for (const entry of ADAPTERS) {
            expect(entry.fullSurface).toBe(true);
            expect(entry.approxBundleKb).toBeGreaterThan(0);
        }
    });

    it("derives the GitHub folder link from REPO_URL + exampleDir", () => {
        expect(githubFolder(ADAPTERS[0])).toBe(`${REPO_URL}/tree/main/examples/canvas2d-adapter`);
    });
});
