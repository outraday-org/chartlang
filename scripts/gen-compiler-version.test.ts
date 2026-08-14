// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
    OUT_OF_DATE_MESSAGE,
    generateCompilerVersion,
    readCompilerVersion,
    renderVersionModule,
} from "./gen-compiler-version";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MODULE_PATH = join(REPO_ROOT, "packages/compiler/src/version.generated.ts");
const COMPILER_PACKAGE_JSON = join(REPO_ROOT, "packages/compiler/package.json");

describe("gen-compiler-version", () => {
    it("emits the version as a string-annotated const, not a literal type", () => {
        const rendered = renderVersionModule("9.8.7");
        expect(rendered).toContain('export const COMPILER_VERSION: string = "9.8.7";');
        expect(rendered).toContain("DO NOT EDIT");
        expect(rendered.endsWith("\n")).toBe(true);
    });

    it("carries the JSDoc the docs gate requires", () => {
        const rendered = renderVersionModule("9.8.7");
        expect(rendered).toContain("@since");
        expect(rendered).toContain("@stable");
        expect(rendered).toContain("@example");
    });

    it("escapes the version through JSON so no source string can break out", () => {
        expect(renderVersionModule('1.0.0"; drop()//')).toContain(
            'COMPILER_VERSION: string = "1.0.0\\"; drop()//";',
        );
    });

    it("reads the version straight from the compiler package manifest", async () => {
        const pkg: unknown = JSON.parse(await readFile(COMPILER_PACKAGE_JSON, "utf8"));
        const declared = (pkg as { readonly version: string }).version;
        await expect(readCompilerVersion()).resolves.toBe(declared);
    });

    it("committed version.generated.ts matches packages/compiler/package.json", async () => {
        const committed = await readFile(MODULE_PATH, "utf8");
        expect(committed).toBe(renderVersionModule(await readCompilerVersion()));
        // …and the byte-diff the gate performs is actually discriminating.
        expect(committed).not.toBe(renderVersionModule("0.0.0-drift"));
    });

    it("--check passes against the committed module", async () => {
        // Write mode is deliberately NOT exercised here — it mutates the
        // working tree, and `check: true` already pins the exact bytes.
        await expect(generateCompilerVersion({ check: true })).resolves.toBeUndefined();
    });

    it("names the drift remedy in the out-of-date message", () => {
        expect(OUT_OF_DATE_MESSAGE).toContain("pnpm compiler:version:generate");
    });
});
