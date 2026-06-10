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
 */
export function ChartPane(props: ChartPaneProps): ReactElement {
    const { artifact, bars } = props;
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const adapterRef = useRef<AdapterHandle | null>(null);
    const generationRef = useRef(0);
    const onAlertRef = useRef(props.onAlert);
    onAlertRef.current = props.onAlert;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas === null || artifact === null || bars.length === 0) return;

        generationRef.current += 1;
        const generation = generationRef.current;

        // Tear down the previous adapter cleanly before spinning up a
        // fresh one. `dispose()` clears the renderer state and
        // terminates the underlying worker.
        adapterRef.current?.dispose();
        adapterRef.current = null;

        let cancelled = false;
        const adapter = createCanvas2dAdapter({
            canvas,
            candleSource: mockCandleSource(bars, { interval: "1D", mode: "stream" }),
            onAlert: (alert) => onAlertRef.current(alert),
        });
        adapterRef.current = adapter;

        const start = async (): Promise<void> => {
            try {
                await adapter.host.load({
                    moduleSource: artifact.moduleSource,
                    manifest: artifact.manifest as ScriptManifest,
                });
                if (cancelled || generationRef.current !== generation) return;
                await runRendererLoop(adapter);
            } catch (err) {
                // A new artifact landed mid-flight (so we disposed the
                // host underneath ourselves); silently drop.
                if (cancelled || generationRef.current !== generation) return;
                console.error("chart render failed", err);
            }
        };
        void start();

        return () => {
            cancelled = true;
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
