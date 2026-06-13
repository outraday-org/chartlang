// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// `export default <expr>;` — the form a hand-written / unbundled source uses.
const EXPORT_DEFAULT_RE = /^\s*export\s+default\s+/m;
const EXPORT_DEFAULT_GLOBAL_RE = /^\s*export\s+default\s+/gm;

// `export { <ident> as default };` — esbuild's bundled form. The compiler
// emits this whenever the source body declares an inner `var x = ...; export
// { x as default };` (which is what every `esbuild.build` ESM bundle does).
// Both single-line `export { foo as default };` and multi-line
// `export {\n  foo as default\n};` are handled.
const EXPORT_RENAMED_DEFAULT_RE =
    /^\s*export\s*\{\s*([A-Za-z_$][\w$]*)\s+as\s+default\s*,?\s*\}\s*;?/m;
const EXPORT_RENAMED_DEFAULT_GLOBAL_RE =
    /^\s*export\s*\{\s*([A-Za-z_$][\w$]*)\s+as\s+default\s*,?\s*\}\s*;?/gm;

const EXPORT_MANIFEST_RE = /^\s*export\s+const\s+__manifest\s*=/m;

// `export const __dependencies = [...];` — §22.10 indicator-composition
// private-dep sidecar from the compiler's `formatDependenciesAssignment`
// emitter. Same shape as `__manifest`; rewrites to the host-realm-visible
// `globalThis.__chartlang_compiled_dependencies` slot.
const EXPORT_DEPENDENCIES_RE = /^\s*export\s+const\s+__dependencies\s*=/m;

// `export const <name> = ...;` — every other named const export. Drives
// the §22.10 multi-export sibling capture. Anchored to start-of-line so
// it never matches `var foo = "export const X = 1"` string literals.
// The reserved sidecar exports (`__manifest`, `__dependencies`) are
// rewritten by their dedicated patterns *before* this one runs, so the
// generic named-export rewrite never sees them in practice.
const EXPORT_NAMED_CONST_GLOBAL_RE = /^(\s*)export\s+const\s+([A-Za-z_$][\w$]*)\s*=/gm;

/**
 * Rewrites a compiled ESM module source so the QuickJS dispatcher can capture
 * the default export and optional `__manifest` const into known globals. The
 * matchers are anchored to the start of a line (`/m` flag) so occurrences
 * inside string literals or block comments mid-file are left alone.
 *
 * Two default-export forms are recognised: the literal
 * `export default <expr>;` produced by hand-written sources and test
 * fixtures, and the renamed form `export { <ident> as default };` produced
 * by `esbuild`'s `bundle: true` output (and emitted by the chartlang
 * compiler's `bundle.ts`). Bundled output is the production path; the
 * literal form keeps unit-test fixtures readable.
 *
 * Throws if the module declares zero or more than one default-export
 * statement (across both forms) — the dispatcher relies on exactly one
 * default-export site so the `globalThis.__chartlang_compiled_default` slot
 * is unambiguous.
 *
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     const out = moduleSourceToScript("export default { compute };");
 *     void out;
 */
export function moduleSourceToScript(source: string): string {
    const literalCount = (source.match(EXPORT_DEFAULT_GLOBAL_RE) ?? []).length;
    const renamedCount = (source.match(EXPORT_RENAMED_DEFAULT_GLOBAL_RE) ?? []).length;
    const total = literalCount + renamedCount;
    if (total === 0) {
        throw new Error("compiled module did not declare an export default");
    }
    if (total > 1) {
        throw new Error("compiled module declared multiple export default statements");
    }

    let out = source;
    if (literalCount === 1) {
        out = out.replace(EXPORT_DEFAULT_RE, "globalThis.__chartlang_compiled_default = ");
    } else {
        out = out.replace(
            EXPORT_RENAMED_DEFAULT_RE,
            (_match, ident: string) => `globalThis.__chartlang_compiled_default = ${ident};`,
        );
    }
    out = out.replace(EXPORT_MANIFEST_RE, "globalThis.__chartlang_compiled_manifest =");
    out = out.replace(EXPORT_DEPENDENCIES_RE, "globalThis.__chartlang_compiled_dependencies =");
    // §22.10 indicator-composition: every remaining `export const X = …;`
    // is a drawn-sibling. Rewrite the binding to seed the host-realm-
    // visible global map with the assigned value so the dispatcher can
    // pluck the compiled `{ manifest, compute }` out when building the
    // `CompiledScriptBundle`. The expression after `=` survives intact,
    // so any trailing semicolon and the value-side reach the global slot
    // unchanged.
    out = out.replace(EXPORT_NAMED_CONST_GLOBAL_RE, (_match, leading: string, name: string) => {
        const key = JSON.stringify(name);
        return `${leading}(globalThis.__chartlang_compiled_named = globalThis.__chartlang_compiled_named || {})[${key}] =`;
    });
    return out;
}
