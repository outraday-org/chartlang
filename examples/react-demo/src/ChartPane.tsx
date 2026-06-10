// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
import type { AlertEmission } from "@invinite-org/chartlang-adapter-kit";
import type { Bar, ScriptManifest } from "@invinite-org/chartlang-core";
import {
    createCanvas2dAdapter,
    runRendererLoop,
} from "chartlang-example-canvas2d-adapter";
import { type ReactElement, useEffect, useRef } from "react";

import type { CompiledArtifact } from "./hybridLanguageService";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 480;
// Stream the last ~5% of bars after a single history batch, so the
// chart paints instantly and a few "ticks" still drive the alert /
// recent-bar surfaces during the demo.
const STREAM_TAIL_BARS = 30;

/**
 * Props for {@link ChartPane}. The pane re-mounts the canvas adapter
 * every time `artifact` changes; the previous adapter is disposed.
 */
export type ChartPaneProps = Readonly<{
    bars: ReadonlyArray<Bar>;
    artifact: CompiledArtifact | null;
    onAlert: (alert: AlertEmission) => void;
}>;

type AdapterHandle = ReturnType<typeof createCanvas2dAdapter>;

/**
 * Right half of the demo. Holds a single `<canvas>` reference; each new
 * artifact disposes the previous adapter, spins up a fresh one, loads
 * the compiled module, and runs the renderer loop in the background.
 *
 * Cancellation flows through an `AbortController` that is wired into
 * `runRendererLoop({ signal })`, so the loop exits silently when a new
 * artifact arrives mid-stream instead of throwing through the disposed
 * adapter.
 */
export function ChartPane(props: ChartPaneProps): ReactElement {
    const { artifact, bars } = props;
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const adapterRef = useRef<AdapterHandle | null>(null);
    const onAlertRef = useRef(props.onAlert);
    onAlertRef.current = props.onAlert;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas === null || artifact === null || bars.length === 0) return;

        // Tear down the previous adapter cleanly before spinning up a
        // fresh one. `dispose()` clears the renderer state and
        // terminates the underlying worker.
        adapterRef.current?.dispose();
        adapterRef.current = null;

        const controller = new AbortController();
        const adapter = createCanvas2dAdapter({
            canvas,
            candleSource: mockCandleSource(bars, {
                interval: "1D",
                mode: "history-then-stream",
                streamTail: STREAM_TAIL_BARS,
            }),
            onAlert: (alert) => onAlertRef.current(alert),
        });
        adapterRef.current = adapter;

        const start = async (): Promise<void> => {
            try {
                await adapter.host.load({
                    moduleSource: artifact.moduleSource,
                    manifest: artifact.manifest as ScriptManifest,
                });
                if (controller.signal.aborted) return;
                await runRendererLoop(adapter, { signal: controller.signal });
            } catch (err) {
                if (controller.signal.aborted) return;
                console.error("chart render failed", err);
            }
        };
        void start();

        return () => {
            controller.abort();
            adapter.dispose();
            if (adapterRef.current === adapter) adapterRef.current = null;
        };
    }, [artifact, bars]);

    useEffect(() => {
        return () => {
            adapterRef.current?.dispose();
            adapterRef.current = null;
        };
    }, []);

    return (
        <div className="chart-pane">
            <canvas
                className="chart-canvas"
                height={CANVAS_HEIGHT}
                ref={canvasRef}
                width={CANVAS_WIDTH}
            />
        </div>
    );
}
