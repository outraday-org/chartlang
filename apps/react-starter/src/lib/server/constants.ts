// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Shared server-only constants. Kept in one place so the source-size cap
// can't drift between the compile route and the saved-script CRUD layer.

/**
 * Max chartlang source length accepted by the server (64 KiB). Enforced
 * identically at the `/api/compile` route (`compile.ts`) and the saved-script
 * save path (`db/scripts.ts`) so a script that compiles can always be saved
 * and vice-versa. The client mirrors this value in `routes/index.tsx` for a
 * pre-flight check (a component must not import this server module), but this
 * is the source of truth.
 */
export const MAX_SOURCE_LENGTH = 64 * 1024
