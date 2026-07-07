// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { type ReactElement, useCallback, useEffect, useRef } from "react";

import { createChartlangEditor } from "../createChartlangEditor.js";
import type { ChartlangEditorOpts, ChartlangEditor as MountedChartlangEditor } from "../types.js";

/**
 * Props for the React CodeMirror chartlang editor wrapper.
 *
 * Pass `service` to inject a custom language-service (typically the only
 * viable browser architecture — local hover / completions, remote
 * `compileToDiagnostics`). `targetCapabilities` is deprecated here; build
 * them into the injected service instead. The component does not re-mount
 * on `service` identity changes.
 *
 * `extensions` forwards arbitrary CodeMirror extensions (themes,
 * keymaps, etc.) to {@link createChartlangEditor}. The array is read
 * at mount time only — like `service`, later identity changes do not
 * re-mount the editor.
 *
 * @since 0.4
 * @stable
 * @example
 *     const props: ChartlangEditorProps = { source: "const value = 1;" };
 *     void props;
 */
export type ChartlangEditorProps = Readonly<{
    source: string;
    onSourceChange?: (next: string) => void;
    targetCapabilities?: ChartlangEditorOpts["targetCapabilities"];
    service?: ChartlangEditorOpts["service"];
    onCompiled?: ChartlangEditorOpts["onCompiled"];
    previewPanel?: ChartlangEditorOpts["previewPanel"];
    previewRunner?: ChartlangEditorOpts["previewRunner"];
    extensions?: ChartlangEditorOpts["extensions"];
    /**
     * Live editor font size in px (clamped to [11, 22]). Unlike `extensions`,
     * this is a reactive seam — changing it reconfigures the mounted view
     * without remounting.
     */
    fontSize?: ChartlangEditorOpts["fontSize"];
    className?: string;
}>;

/**
 * Mount the framework-agnostic CodeMirror editor inside a React component.
 *
 * @since 0.4
 * @stable
 * @example
 *     const element = <ChartlangEditor source="const value = 1;" />;
 *     void element;
 */
export function ChartlangEditor(props: ChartlangEditorProps): ReactElement {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const editorRef = useRef<MountedChartlangEditor | null>(null);
    const sourceRef = useRef(props.source);
    const targetCapabilitiesRef = useRef(props.targetCapabilities);
    const serviceRef = useRef(props.service);
    const previewPanelRef = useRef(props.previewPanel);
    const previewRunnerRef = useRef(props.previewRunner);
    const extensionsRef = useRef(props.extensions);
    const fontSizeRef = useRef(props.fontSize);
    const onSourceChangeRef = useRef(props.onSourceChange);

    targetCapabilitiesRef.current = props.targetCapabilities;
    serviceRef.current = props.service;
    previewPanelRef.current = props.previewPanel;
    previewRunnerRef.current = props.previewRunner;
    extensionsRef.current = props.extensions;
    fontSizeRef.current = props.fontSize;
    onSourceChangeRef.current = props.onSourceChange;

    const setContainer = useCallback((node: HTMLDivElement | null): void => {
        if (node === null) {
            editorRef.current?.destroy();
            editorRef.current = null;
            containerRef.current = null;
            return;
        }
        containerRef.current = node;
        const editor = createChartlangEditor({
            doc: sourceRef.current,
            ...(targetCapabilitiesRef.current === undefined
                ? {}
                : { targetCapabilities: targetCapabilitiesRef.current }),
            ...(serviceRef.current === undefined ? {} : { service: serviceRef.current }),
            ...(previewPanelRef.current === undefined
                ? {}
                : { previewPanel: previewPanelRef.current }),
            ...(previewRunnerRef.current === undefined
                ? {}
                : { previewRunner: previewRunnerRef.current }),
            ...(extensionsRef.current === undefined ? {} : { extensions: extensionsRef.current }),
            ...(fontSizeRef.current === undefined ? {} : { fontSize: fontSizeRef.current }),
            onSourceChange: (next) => {
                sourceRef.current = next;
                onSourceChangeRef.current?.(next);
            },
            parent: node,
        });
        editorRef.current = editor;
    }, []);

    useEffect(() => {
        if (editorRef.current !== null && props.source !== sourceRef.current) {
            editorRef.current.setSource(props.source);
            sourceRef.current = props.source;
        }
    }, [props.source]);

    useEffect(() => {
        if (props.fontSize !== undefined) editorRef.current?.setFontSize(props.fontSize);
    }, [props.fontSize]);

    useEffect(() => {
        // Deprecated no-op kept for compatibility. Capability updates
        // belong to the injected service.
        editorRef.current?.setCapabilities(props.targetCapabilities ?? null);
    }, [props.targetCapabilities]);

    return <div className={props.className} ref={setContainer} />;
}
