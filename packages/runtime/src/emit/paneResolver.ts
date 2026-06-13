// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ScriptManifest } from "@invinite-org/chartlang-core";

import type { RuntimeContext } from "../runtimeContext.js";
import { pushDiagnostic } from "./emissionsQueue.js";

const SANITISE_PANE_KEY = /[^a-zA-Z0-9_-]/g;

/**
 * Derive the stable non-overlay pane key for a script from its
 * manifest name. The name is sanitised (`/[^a-zA-Z0-9_-]/g` → `-`) so
 * it fits the `string` shape on `PlotEmission.pane` and cannot collide
 * with the `script:` prefix structure (e.g. a `:` in the name becomes
 * `-`); an empty name falls back to `"script:default"`. Both the
 * primary runner and every dep / sibling sub-runner key off this so a
 * script's distinct name yields a distinct subpane.
 *
 * @since 0.2
 * @stable
 * @example
 *     // resolveScriptPane({ name: "RSI Cross", ... }) === "script:RSI-Cross"
 *     // resolveScriptPane({ name: "", ... }) === "script:default"
 */
export function resolveScriptPane(manifest: ScriptManifest): string {
    const sanitised = manifest.name.replace(SANITISE_PANE_KEY, "-");
    return `script:${sanitised === "" ? "default" : sanitised}`;
}

/**
 * Resolve a script's mount-time default pane from `manifest.overlay`.
 * `overlay` absent / `true` → `"overlay"` (the price pane); `overlay
 * === false` → the script-owned subpane key from
 * {@link resolveScriptPane}. The runner sets `RuntimeContext.defaultPane`
 * to this once at mount; {@link resolvePane} reads it for any `plot()` /
 * `hline()` call with no explicit `pane`.
 *
 * @since 0.2
 * @stable
 * @example
 *     // resolveDefaultPane({ name: "x", overlay: false, ... }) === "script:x"
 *     // resolveDefaultPane({ name: "x", ... }) === "overlay"
 */
export function resolveDefaultPane(manifest: ScriptManifest): string {
    return manifest.overlay === false ? resolveScriptPane(manifest) : "overlay";
}

function resolveNamedPane(pane: string, ctx: RuntimeContext, slotId: string): string {
    if (ctx.capabilities.subPanes >= 1) return pane;
    pushDiagnostic(ctx.emissions, {
        kind: "diagnostic",
        severity: "warning",
        code: "unsupported-pane",
        message: `Adapter declares subPanes: 0; pane "${pane}" folded to overlay.`,
        slotId,
        bar: ctx.barIndex(),
    });
    return "overlay";
}

/**
 * Resolve the pane a `plot()` / `hline()` call routes to. Four
 * branches:
 *   - `"overlay"` → `"overlay"` (the price pane; never folds).
 *   - `undefined` → `ctx.defaultPane` (the script's mount-time default
 *     from `manifest.overlay`).
 *   - `"new"` → `ctx.scriptPane` (one stable subpane per script, so
 *     every `"new"` callsite in a script joins the same subpane).
 *   - any other string → returned unchanged when
 *     `capabilities.subPanes >= 1`; otherwise folded to `"overlay"`
 *     with an `unsupported-pane` diagnostic (the bare-bones adapter
 *     compat path).
 *
 * The Phase-1 signature returned the literal `"overlay"` and folded every
 * non-overlay request; the four-branch router widens the return type to
 * `string` and the new `undefined` / `"new"` / named-pass-through
 * branches arrive at `@since 0.2`.
 *
 * @since 0.2
 * @stable
 * @example
 *     // import { resolvePane } from "@invinite-org/chartlang-runtime/emit";
 *     // const pane = resolvePane("rsi", ctx, "demo.ts:1:1#0");
 *     // pane === "rsi" // when ctx.capabilities.subPanes >= 1
 */
export function resolvePane(
    requested: string | undefined,
    ctx: RuntimeContext,
    slotId: string,
): string {
    if (requested === "overlay") return "overlay";
    if (requested === undefined) return ctx.defaultPane;
    if (requested === "new") return resolveNamedPane(ctx.scriptPane, ctx, slotId);
    return resolveNamedPane(requested, ctx, slotId);
}
