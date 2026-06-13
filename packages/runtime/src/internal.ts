// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Internal runtime entrypoint consumed by compiler-emitted bundles.
 * NOT a script-author surface — user `.chart.ts` files cannot import
 * from this module; the compiler's `extractDependencyGraph` rewrites
 * every `<binding>.output("title")` call into the runtime helper
 * exposed here.
 *
 * @since 0.7
 * @stable
 */

export {
    DEP_OUTPUT_GLOBAL_KEY,
    __chartlang_depOutput,
    installDepOutputGlobal,
} from "./dep/depOutput.js";
