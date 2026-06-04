// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import {
    GITIGNORE,
    INDEX_TEST_TS,
    INDEX_TS,
    PACKAGE_JSON,
    README_MD,
    TSCONFIG,
    titleCase,
} from "./templates";

describe("titleCase", () => {
    it("uppercases the first character", () => {
        expect(titleCase("demo")).toBe("Demo");
        expect(titleCase("my-adapter")).toBe("My-adapter");
    });

    it("returns the empty string unchanged", () => {
        expect(titleCase("")).toBe("");
    });
});

describe("PACKAGE_JSON", () => {
    it("renders valid JSON with the expected name and metadata", () => {
        const text = PACKAGE_JSON("demo", "2026-06-04");
        const parsed = JSON.parse(text);
        expect(parsed.name).toBe("chartlang-adapter-demo");
        expect(parsed.private).toBe(true);
        expect(parsed.type).toBe("module");
        expect(parsed.dependencies["@invinite-org/chartlang-adapter-kit"]).toBeTruthy();
        expect(parsed.dependencies["@invinite-org/chartlang-host-worker"]).toBeTruthy();
        expect(parsed.description).toMatch(/scaffolded 2026-06-04/);
    });
});

describe("TSCONFIG", () => {
    it("renders valid JSON with strict mode and ES2022 target", () => {
        const parsed = JSON.parse(TSCONFIG);
        expect(parsed.compilerOptions.strict).toBe(true);
        expect(parsed.compilerOptions.target).toBe("ES2022");
        expect(parsed.compilerOptions.verbatimModuleSyntax).toBe(true);
    });
});

describe("INDEX_TS", () => {
    it("includes adapter-kit imports and the supplied name", () => {
        const text = INDEX_TS("my-adapter");
        expect(text).toMatch(/from "@invinite-org\/chartlang-adapter-kit"/);
        expect(text).toMatch(/defineAdapter/);
        expect(text).toMatch(/capabilities/);
        expect(text).toMatch(/mockCandleSource/);
        expect(text).toMatch(/id: "my-adapter"/);
        expect(text).toMatch(/name: "My-adapter"/);
    });
});

describe("INDEX_TEST_TS", () => {
    it("references the supplied name in the describe block and assertion", () => {
        const text = INDEX_TEST_TS("demo");
        expect(text).toMatch(/describe\("chartlang-adapter-demo"/);
        expect(text).toMatch(/expect\(adapter\.id\)\.toBe\("demo"\)/);
    });
});

describe("README_MD", () => {
    it("emits a Phase-1 §17.1-shaped README ≤100 lines", () => {
        const text = README_MD("demo", "2026-06-04");
        const lines = text.split("\n");
        expect(lines.length).toBeLessThanOrEqual(100);
        expect(text).toMatch(/^# chartlang-adapter-demo/);
        expect(text).toMatch(/`experimental`/);
        expect(text).toMatch(/Scaffolded on 2026-06-04/);
        expect(text).toMatch(/pnpm add chartlang-adapter-demo/);
        expect(text).toMatch(/## License\n\nMIT/);
    });
});

describe("GITIGNORE", () => {
    it("excludes node_modules, dist, and coverage", () => {
        expect(GITIGNORE).toBe("node_modules/\ndist/\ncoverage/\n");
    });
});
