// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { moduleSourceToScript } from "./moduleSourceToScript";

describe("moduleSourceToScript", () => {
    it("rewrites the single export default into a global assignment", () => {
        const out = moduleSourceToScript("export default { manifest, compute };");
        expect(out).toBe("globalThis.__chartlang_compiled_default = { manifest, compute };");
    });

    it("rewrites export const __manifest into a global assignment", () => {
        const src = "export const __manifest = { name: 'x' };\nexport default { compute };";
        const out = moduleSourceToScript(src);
        expect(out).toContain("globalThis.__chartlang_compiled_manifest = { name: 'x' };");
        expect(out).toContain("globalThis.__chartlang_compiled_default = { compute };");
    });

    it("ignores `export default` inside a string literal", () => {
        const src = 'const banner = "export default fake";\nexport default { compute };';
        const out = moduleSourceToScript(src);
        expect(out).toBe(
            'const banner = "export default fake";\nglobalThis.__chartlang_compiled_default = { compute };',
        );
    });

    it("ignores `export default` inside a line comment", () => {
        const src = "// export default ignored\nexport default { compute };";
        const out = moduleSourceToScript(src);
        expect(out).toContain("// export default ignored");
        expect(out).toContain("globalThis.__chartlang_compiled_default = { compute };");
    });

    it("throws when there is no export default", () => {
        expect(() => moduleSourceToScript("const x = 1;")).toThrow(
            /did not declare an export default/,
        );
    });

    it("throws when there are multiple export default statements", () => {
        const src = "export default { a: 1 };\nexport default { b: 2 };";
        expect(() => moduleSourceToScript(src)).toThrow(/multiple export default statements/);
    });
});
