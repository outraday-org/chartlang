// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { AlertConditionEmission } from "@invinite-org/chartlang-adapter-kit";

import type { RuntimeContext } from "../runtimeContext.js";
import { pushAlertCondition, pushDiagnostic } from "./emissionsQueue.js";

function diagnoseOnce(
    ctx: RuntimeContext,
    code: "alert-conditions-not-supported" | "unknown-alert-condition",
    conditionId: string,
    message: string,
): void {
    const key = `${code}|${conditionId}`;
    const diagnosed = ctx.diagnosedAlertConditionKeys;
    if (diagnosed?.has(key)) return;
    diagnosed?.add(key);
    pushDiagnostic(ctx.emissions, {
        kind: "diagnostic",
        severity: "warning",
        code,
        message,
        slotId: null,
        bar: ctx.barIndex(),
    });
}

/**
 * Emit one alert-condition state transition for the current bar.
 * `fired: false` is emitted deliberately so adapters can render falling
 * edges and "currently inactive" state without remembering prior bars.
 *
 * @since 0.5
 * @stable
 * @example
 *     // emitAlertCondition(ctx, "up", true);
 *     const fn: typeof emitAlertCondition = emitAlertCondition;
 *     void fn;
 */
export function emitAlertCondition(ctx: RuntimeContext, conditionId: string, fired: boolean): void {
    if (!ctx.capabilities.alertConditions) {
        diagnoseOnce(
            ctx,
            "alert-conditions-not-supported",
            conditionId,
            "Adapter does not support alert conditions; signal dropped.",
        );
        return;
    }
    const condition = ctx.alertConditions?.get(conditionId);
    if (condition === undefined) {
        diagnoseOnce(
            ctx,
            "unknown-alert-condition",
            conditionId,
            `Alert condition "${conditionId}" is not declared in the script manifest.`,
        );
        return;
    }
    const emission: AlertConditionEmission = {
        kind: "alert-condition",
        conditionId,
        title: condition.title,
        description: condition.description,
        defaultMessage: condition.defaultMessage,
        fired,
        bar: ctx.barIndex(),
        time: ctx.stream.bar.time,
    };
    pushAlertCondition(ctx.emissions, emission);
}
