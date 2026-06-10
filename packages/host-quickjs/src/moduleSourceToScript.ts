// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

const EXPORT_DEFAULT_RE = /^\s*export\s+default\s+/m;
const EXPORT_DEFAULT_GLOBAL_RE = /^\s*export\s+default\s+/gm;
const EXPORT_MANIFEST_RE = /^\s*export\s+const\s+__manifest\s*=/m;

/**
 * Rewrites a compiled ESM module source so the QuickJS dispatcher can capture
 * the default export and optional `__manifest` const into known globals. The
 * `export default` / `export const __manifest` matchers are anchored to the
 * start of a line (`/m` flag) so occurrences inside string literals or block
 * comments mid-file are left alone.
 *
 * Throws if the module declares zero or more than one `export default`
 * statement — the dispatcher relies on exactly one default-export site so the
 * `globalThis.__chartlang_compiled_default` slot is unambiguous.
 *
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     const out = moduleSourceToScript("export default { compute };");
 *     void out;
 */
export function moduleSourceToScript(source: string): string {
    const defaultMatches = source.match(EXPORT_DEFAULT_GLOBAL_RE);
    if (defaultMatches === null || defaultMatches.length === 0) {
        throw new Error("compiled module did not declare an export default");
    }
    if (defaultMatches.length > 1) {
        throw new Error("compiled module declared multiple export default statements");
    }
    return source
        .replace(EXPORT_DEFAULT_RE, "globalThis.__chartlang_compiled_default = ")
        .replace(EXPORT_MANIFEST_RE, "globalThis.__chartlang_compiled_manifest =");
}
