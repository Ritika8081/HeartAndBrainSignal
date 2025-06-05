'use client';
import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { WebglPlot, WebglLine, ColorRGBA } from 'webgl-plot';

export type HRVPlotCanvasHandle = {
    /** Force a redraw of the plot */
    redraw: () => void;
    /** Push a new HRV value into the ring buffer */
    updateHRV: (hrv: number) => void;
    /** Get the canvas element */
    getCanvas: () => HTMLCanvasElement | null;
};

type Props = {
    /** Number of points to display */
    numPoints?: number;
    /** Hex color for the line */
    color?: string;
};


const HRVPlotCanvas = forwardRef<HRVPlotCanvasHandle, Props>(
    ({ numPoints = 2000, color = '#d97706' }, ref) => {
        const canvasRef = useRef<HTMLCanvasElement>(null);
        const plotRef = useRef<WebglPlot | null>(null);
        const lineRef = useRef<WebglLine | null>(null);
        const sweepRef = useRef(0);

        // convert hex to ColorRGBA
        function hexToRGBA(hex: string): ColorRGBA {
            const r = parseInt(hex.slice(1, 3), 16) / 255;
            const g = parseInt(hex.slice(3, 5), 16) / 255;
            const b = parseInt(hex.slice(5, 7), 16) / 255;
            return new ColorRGBA(r, g, b, 1);
        }

        // expose imperative methods
        useImperativeHandle(ref, () => ({
            redraw: () => plotRef.current?.update() ?? undefined,
            updateHRV: (hrv: number) => {
                const safeHRV = Math.max(0, Math.min(hrv, 1500));  // Clamp to safe range
                const a = (safeHRV - 750) * (2 / 1500);            // Normalize around 750ms

                const line = lineRef.current;
                if (!line) return;
                const idx = sweepRef.current;
                line.setY(idx, a);
                sweepRef.current = (idx + 1) % line.numPoints;
                plotRef.current?.update();
            },
            getCanvas: () => canvasRef.current,
        }), []);

        useEffect(() => {
            const canvas = canvasRef.current!;
            const resize = () => {
                const { width, height } = canvas.getBoundingClientRect();

                const dpr = window.devicePixelRatio || 1;
                canvas.width = width * dpr;
                canvas.height = height * dpr;

                const gl = canvas.getContext('webgl');
                if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
                plotRef.current?.update();
            };
            // observe container resizes
            const ro = new ResizeObserver(resize);
            ro.observe(canvas);
            // **initial** sizing
            resize();

            return () => {
                ro.disconnect();
            };
        }, []);


        // Update the initialization part in HRVPlotCanvas.tsx
        useEffect(() => {
            if (!canvasRef.current) return;
            const canvas = canvasRef.current;
            const plot = new WebglPlot(canvas);
            const line = new WebglLine(hexToRGBA(color), numPoints);

            // space X from -1 to 1
            line.lineSpaceX(-1, 2 / numPoints);

            // Initialize with 0 instead of NaN
            for (let i = 0; i < line.numPoints; i++) {
                line.setY(i, 0); // Changed from NaN to 0
            }


            plot.addLine(line);
            plotRef.current = plot;
            lineRef.current = line;
            sweepRef.current = 0;

            plot.update();

            return () => {
                plotRef.current = null;
                lineRef.current = null;
            };
        }, [numPoints, color]);


        return (
            <canvas
                ref={canvasRef}
                style={{ width: '100%', height: '100%'}}
            />
        );
    }
);

HRVPlotCanvas.displayName = 'HRVPlotCanvas';

export default HRVPlotCanvas;
