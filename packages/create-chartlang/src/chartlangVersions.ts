// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * The git ref (`giget` source suffix) the installer clones the starter from.
 * A single release-time pin point: a published `create-chartlang@x.y.z`
 * should clone the matching tagged starter so a given installer release
 * always produces a self-consistent project. `#main` until the first tagged
 * release; the release pipeline bumps it.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { STARTER_CLONE_REF } from "@invinite-org/create-chartlang";
 *     const source = `github:outraday-org/chartlang/apps/react-starter${STARTER_CLONE_REF}`;
 *     void source;
 */
export const STARTER_CLONE_REF = "#main";

/**
 * Published `^`-ranges for every `@invinite-org/chartlang-*` package the
 * cloned starter can reference. The installer rewrites the starter's
 * `workspace:*` chartlang deps to real ranges: it prefers the vendored
 * adapter bundle's own (generator-pinned) dep map, then falls back to this
 * baked manifest for packages the bundle does not list (e.g. the editor +
 * language-service the starter's UI imports but no adapter depends on).
 *
 * Maintenance: bump an entry whenever the matching package publishes a new
 * minor/major and the starter should track it. See
 * `packages/create-chartlang/CLAUDE.md`.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { CHARTLANG_VERSIONS } from "@invinite-org/create-chartlang";
 *     const range = CHARTLANG_VERSIONS["@invinite-org/chartlang-editor"];
 *     void range;
 */
export const CHARTLANG_VERSIONS: Readonly<Record<string, string>> = {
    "@invinite-org/chartlang-adapter-kit": "^1.3.0",
    "@invinite-org/chartlang-compiler": "^1.3.0",
    "@invinite-org/chartlang-core": "^1.2.0",
    "@invinite-org/chartlang-editor": "^2.1.3",
    "@invinite-org/chartlang-host-worker": "^1.2.0",
    "@invinite-org/chartlang-language-service": "^1.4.2",
};
