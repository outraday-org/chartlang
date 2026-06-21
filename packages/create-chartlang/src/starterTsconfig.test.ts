// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { STANDALONE_TSCONFIG_BASE, writeStandaloneTsconfig } from "./starterTsconfig.js";

// The real monorepo base config — `../../../tsconfig.base.json` from `src/`.
// Imported directly so the baked constant can never silently drift from it.
const REPO_BASE_PATH = fileURLToPath(new URL("../../../tsconfig.base.json", import.meta.url));

let dir: string;

beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "starter-tsconfig-"));
});

afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
});

describe("STANDALONE_TSCONFIG_BASE", () => {
    it("deep-equals the real repo-root tsconfig.base.json", async () => {
        const real = JSON.parse(await readFile(REPO_BASE_PATH, "utf8")) as unknown;
        expect(JSON.parse(JSON.stringify(STANDALONE_TSCONFIG_BASE))).toEqual(real);
    });
});

describe("writeStandaloneTsconfig", () => {
    it("writes the base and repoints the cloned tsconfig extends", async () => {
        await writeFile(
            join(dir, "tsconfig.json"),
            JSON.stringify({ extends: "../../tsconfig.base.json", include: ["src"] }, null, 4),
            "utf8",
        );
        await writeStandaloneTsconfig(dir);

        const base = JSON.parse(await readFile(join(dir, "tsconfig.base.json"), "utf8")) as unknown;
        expect(base).toEqual(JSON.parse(JSON.stringify(STANDALONE_TSCONFIG_BASE)));

        const tsconfig = JSON.parse(await readFile(join(dir, "tsconfig.json"), "utf8")) as {
            extends: string;
            include: ReadonlyArray<string>;
        };
        expect(tsconfig.extends).toBe("./tsconfig.base.json");
        // Other fields are preserved.
        expect(tsconfig.include).toEqual(["src"]);
    });

    it("writes the base and skips the repoint when the clone has no tsconfig.json", async () => {
        await mkdir(dir, { recursive: true });
        await writeStandaloneTsconfig(dir);

        const base = JSON.parse(await readFile(join(dir, "tsconfig.base.json"), "utf8")) as unknown;
        expect(base).toEqual(JSON.parse(JSON.stringify(STANDALONE_TSCONFIG_BASE)));
        await expect(readFile(join(dir, "tsconfig.json"), "utf8")).rejects.toThrow();
    });
});
