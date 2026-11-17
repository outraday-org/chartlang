// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { RunnerEmissions } from "@invinite-org/chartlang-adapter-kit";

import { AlertRunnerError } from "./errors.js";
import { openRunner } from "./runner.js";
import type {
    AlertBar,
    BarCloseOpts,
    CreateSeriesRunnerOpts,
    SeriesPlotValues,
    SeriesRunner,
    WarmUpOpts,
} from "./types.js";

function plotValue(value: number | null): number {
    return typeof value === "number" && Number.isFinite(value) ? value : Number.NaN;
}

/**
 * The selected slots' values in one drain: per slot its FIRST emission
 * (invinite's `pickPlotSlotValue`), `NaN` when it emitted nothing.
 */
function pickPlots(drained: RunnerEmissions, slots: ReadonlyArray<string>): SeriesPlotValues {
    const out: Record<string, number> = {};
    for (const slot of slots) out[slot] = Number.NaN;
    const seen = new Set<string>();
    for (const plot of drained.plots) {
        if (seen.has(plot.slotId) || !Object.hasOwn(out, plot.slotId)) continue;
        seen.add(plot.slotId);
        out[plot.slotId] = plotValue(plot.value);
    }
    return Object.freeze(out);
}

function nanPlots(slots: ReadonlyArray<string>): SeriesPlotValues {
    return Object.freeze(Object.fromEntries(slots.map((slot) => [slot, Number.NaN])));
}

function assertPlotSlots(
    plotSlots: unknown,
    manifest: CreateSeriesRunnerOpts["compiled"]["manifest"],
): ReadonlyArray<string> {
    if (!Array.isArray(plotSlots) || plotSlots.length === 0) {
        throw new AlertRunnerError("invalid-argument", "plotSlots must list at least one slot id");
    }
    const known = new Set((manifest.plots ?? []).map((plot) => plot.slotId));
    const seen = new Set<string>();
    for (const slot of plotSlots) {
        if (typeof slot !== "string" || !known.has(slot)) {
            throw new AlertRunnerError(
                "invalid-argument",
                `plot slot ${JSON.stringify(slot)} is not one of the script's manifest plots`,
            );
        }
        if (seen.has(slot)) {
            throw new AlertRunnerError(
                "invalid-argument",
                `plot slot ${JSON.stringify(slot)} is listed twice`,
            );
        }
        seen.add(slot);
    }
    return Object.freeze([...seen]);
}

/**
 * Turn a compiled chartlang script into a PRODUCER: an alert runner that
 * also hands back the values of selected plot slots per bar, so a host can
 * feed them to another script's `input.externalSeries` (a script chain).
 * Same sandbox, limits, snapshot and failure rules as `createAlertRunner`; a
 * producer needs no alert, may itself feed `externalSeries` (nested chains)
 * and takes `onSecondaryBarClose`.
 *
 * `warmUp` returns one array per slot aligned to the main warm-up bars,
 * `onBarClose` the slot values of that bar (`NaN` when the slot emitted
 * nothing, `null` or a non-finite value), `onPreClose` those of the forming
 * bar, evaluated on a copy. Throws like `createAlertRunner`, plus
 * `"invalid-argument"` for an empty, duplicate or unknown slot id (not in
 * `manifest.plots`).
 *
 * @since 1.1
 * @stable
 * @example
 *     import { createSeriesRunner } from "@invinite-org/chartlang-alert-runner";
 *
 *     const producer = await createSeriesRunner({
 *         compiled,
 *         symInfo: { ticker: "AAPL" },
 *         interval: "1h",
 *         plotSlots: [slotId],
 *     });
 *     const { plots } = await producer.warmUp(history);
 *     const next = await producer.onBarClose(bar);
 *     void plots[slotId];
 *     void next.plots[slotId];
 *     producer.dispose();
 */
export async function createSeriesRunner(opts: CreateSeriesRunnerOpts): Promise<SeriesRunner> {
    const slots = assertPlotSlots(opts.plotSlots, opts.compiled.manifest);
    const core = await openRunner({ ...opts, frequency: opts.frequency ?? "every_time" });

    async function warmUp(
        bars: ReadonlyArray<AlertBar>,
        warmOpts?: WarmUpOpts,
    ): ReturnType<SeriesRunner["warmUp"]> {
        const arrays = new Map<string, number[]>();
        for (const slot of slots) arrays.set(slot, new Array<number>(bars.length).fill(Number.NaN));
        const filled = new Set<string>();
        await core.warmUp(bars, warmOpts, (shift, drained) => {
            for (const plot of drained.plots) {
                const values = arrays.get(plot.slotId);
                const position = plot.bar + shift;
                const id = `${plot.slotId}\u0000${position}`;
                // A history drain holds only its own chunk's bars, so the
                // position is always inside the warm-up window.
                if (values === undefined || filled.has(id)) continue;
                filled.add(id);
                values[position] = plotValue(plot.value);
            }
        });
        return Object.freeze({ plots: Object.freeze(Object.fromEntries(arrays)) });
    }

    async function onBarClose(
        bar: AlertBar,
        closeOpts?: BarCloseOpts,
    ): ReturnType<SeriesRunner["onBarClose"]> {
        const step = await core.onBarClose(bar, closeOpts);
        if (step === null)
            return Object.freeze({ folded: false, events: [], plots: nanPlots(slots) });
        return Object.freeze({
            folded: true,
            events: step.events,
            plots: pickPlots(step.drained, slots),
        });
    }

    async function onPreClose(
        bar: AlertBar,
        offsetMs: number,
        closeOpts?: BarCloseOpts,
    ): ReturnType<SeriesRunner["onPreClose"]> {
        const step = await core.onPreClose(bar, offsetMs, closeOpts);
        return Object.freeze({ ...step.result, plots: pickPlots(step.drained, slots) });
    }

    return Object.freeze<SeriesRunner>(
        Object.defineProperties(
            { plotSlots: slots, warmUp, onBarClose, onPreClose },
            Object.getOwnPropertyDescriptors(core.shared),
        ) as SeriesRunner,
    );
}
