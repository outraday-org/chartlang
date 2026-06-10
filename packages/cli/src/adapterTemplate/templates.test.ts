// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import {
    CONFORMANCE_REPORT_TS,
    CONFORMANCE_TEST_TS,
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
        expect(parsed.scripts["conformance:report"]).toBe("tsx scripts/conformance-report.ts");
        expect(parsed.dependencies["@invinite-org/chartlang-adapter-kit"]).toBe("^1.0.0");
        expect(parsed.dependencies["@invinite-org/chartlang-host-worker"]).toBe("^1.0.0");
        expect(parsed.devDependencies["@invinite-org/chartlang-conformance"]).toBe("^1.0.0");
        expect(parsed.devDependencies.tsx).toBeTruthy();
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
        expect(text).toMatch(/export default adapter/);
    });
});

describe("INDEX_TEST_TS", () => {
    it("references the supplied name in the describe block and assertion", () => {
        const text = INDEX_TEST_TS("demo");
        expect(text).toMatch(/describe\("chartlang-adapter-demo"/);
        expect(text).toMatch(/expect\(adapter\.id\)\.toBe\("demo"\)/);
    });
});

describe("CONFORMANCE_TEST_TS", () => {
    it("runs the public conformance suite against the default adapter export", () => {
        expect(CONFORMANCE_TEST_TS).toMatch(/runConformanceSuite/);
        expect(CONFORMANCE_TEST_TS).toMatch(/import adapter from "\.\/index\.js"/);
        expect(CONFORMANCE_TEST_TS).toMatch(/expect\(report\.failed\)\.toBe\(0\)/);
        expect(CONFORMANCE_TEST_TS).toMatch(/60_000/);
    });
});

describe("CONFORMANCE_REPORT_TS", () => {
    it("writes the public markdown and json conformance reports", () => {
        expect(CONFORMANCE_REPORT_TS).toMatch(/renderConformanceMarkdown/);
        expect(CONFORMANCE_REPORT_TS).toMatch(/renderConformanceJson/);
        expect(CONFORMANCE_REPORT_TS).toMatch(/CONFORMANCE\.md/);
        expect(CONFORMANCE_REPORT_TS).toMatch(/conformance-report\.json/);
    });
});

describe("README_MD", () => {
    it("emits a Phase-1 §17.1-shaped README ≤100 lines", () => {
        const text = README_MD("demo", "2026-06-04");
        const lines = text.split("\n");
        expect(lines.length).toBeLessThanOrEqual(100);
        expect(text).toMatch(/^# chartlang-adapter-demo/);
        expect(text).toMatch(/`stable`/);
        expect(text).toMatch(/Scaffolded on 2026-06-04/);
        expect(text).toMatch(/pnpm add chartlang-adapter-demo/);
        expect(text).toMatch(/pnpm conformance:report/);
        expect(text).toMatch(/## License\n\nMIT/);
    });
});

describe("GITIGNORE", () => {
    it("excludes node_modules, dist, and coverage", () => {
        expect(GITIGNORE).toBe("node_modules/\ndist/\ncoverage/\n");
    });
});
