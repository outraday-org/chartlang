// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// The public surface is the generated catalogue data module. Its
// declarations carry the JSDoc (`@since` / `@example` / stability) that
// `pnpm docs:check` enforces; this barrel only forwards them. Re-run
// `pnpm examples:generate` after changing the catalogue — never hand-edit
// `catalogue.generated.ts`.
export {
    CATEGORY_LABELS,
    CATEGORY_ORDER,
    EXAMPLE_CATALOGUE,
    type ExampleCategory,
    type ExampleMeta,
    type ExampleMetaWithSource,
} from "./catalogue.generated.js";
