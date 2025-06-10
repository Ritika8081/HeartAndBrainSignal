'use client';
import React, { useEffect, useRef, useImperativeHandle, forwardRef ,useCallback} from 'react';
import { WebglPlot, WebglLine, ColorRGBA } from 'webgl-plot';

export type HRVPlotCanvasHandle = {
    /** Force a redraw of the plot */
    redraw: () => void;
    /** Push a new HRV value into the ring buffer */
    updateHRV: (hrv: number) => void;
    /** Get the canvas element */
    getCanvas: () => HTMLCanvasElement | null;
    darkMode: boolean; };

type Props = {
    /** Number of points to display */
    numPoints?: number;
    /** Hex color for the line */
    color?: string;
    darkMode?: boolean;
};


const HRVPlotCanvas = forwardRef<HRVPlotCanvasHandle, Props>(
    ({ numPoints = 2000, color = '#d97706',darkMode = false }, ref) => {
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
            darkMode: darkMode,
        }), [darkMode]);
        console.log(darkMode);
        const containerRef = useRef<HTMLDivElement>(null)
        // Constants (could be props if needed)
        const samplingRate = 500
        const selectedBits = 10
        const theme = 'dark'
        const gridCreatedRef = useRef(false) // Track if grid has been created
        const createGridLines = useCallback(() => {
            if (!containerRef.current) return;
            
            // Clear existing grid lines if they exist
            const existingWrapper = containerRef.current.querySelector('.grid-lines-wrapper');
            if (existingWrapper) {
                containerRef.current.removeChild(existingWrapper);
            }
        
            const canvasWrapper = document.createElement("div");
            canvasWrapper.className = "grid-lines-wrapper absolute inset-0 pointer-events-none";
        
            const opacityDarkMajor = "0.2";
            const opacityDarkMinor = "0.05";
            const opacityLightMajor = "0.4";
            const opacityLightMinor = "0.1";
            const distanceminor = samplingRate * 0.04;
            const numGridLines = (Math.pow(2, selectedBits) * 4 / distanceminor);
        
            // Vertical lines
            for (let j = 1; j < numGridLines; j++) {
                const gridLineX = document.createElement("div");
                gridLineX.className = "absolute bg-[rgb(128,128,128)]";
                gridLineX.style.width = "1px";
                gridLineX.style.height = "100%";
                gridLineX.style.left = `${((j / numGridLines) * 100).toFixed(3)}%`;
                gridLineX.style.opacity = j % 5 === 0
                    ? (darkMode ? opacityDarkMajor : opacityLightMajor)
                    : (darkMode ? opacityDarkMinor : opacityLightMinor);
                canvasWrapper.appendChild(gridLineX);
            }
        
            // Horizontal lines with labels
            const horizontalline = 70;
            const maxValue = 1400;
            for (let j = 1; j < horizontalline; j++) {
                const gridLineY = document.createElement("div");
                gridLineY.className = "absolute bg-[rgb(128,128,128)]";
                gridLineY.style.height = "1px";
                gridLineY.style.width = "100%";
                gridLineY.style.top = `${((j / horizontalline) * 100).toFixed(3)}%`;
                const isMajorLine = j % 5 === 0;
                gridLineY.style.opacity = isMajorLine
                    ? (darkMode ? opacityDarkMajor : opacityLightMajor)
                    : (darkMode ? opacityDarkMinor : opacityLightMinor);
                canvasWrapper.appendChild(gridLineY);
        
                if (isMajorLine) {
                    const labelValue = Math.round(maxValue - (j / horizontalline) * maxValue);
                    if (labelValue % 200 === 0 || labelValue === 0 || labelValue === maxValue) {
                        const label = document.createElement("div");
                        label.className = "absolute text-[0.65rem] pointer-events-none";
                        label.style.left = "4px";
                        label.style.top = `${((j / horizontalline) * 100).toFixed(3)}%`;
                        label.style.transform = "translateY(-50%)";
                        label.style.color = darkMode ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.7)";
                        label.textContent = labelValue.toString();
                        canvasWrapper.appendChild(label);
                    }
                }
            }
        
            containerRef.current.appendChild(canvasWrapper);
        }, [darkMode]);
        createGridLines();
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

        useEffect(() => {
            const handleResize = () => {
                createGridLines();

            };
            window.addEventListener("resize", handleResize);
            return () => {
                window.removeEventListener("resize", handleResize);
            };
        }, [createGridLines]);
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
            <div ref={containerRef} className="relative w-full h-full">

                <canvas
                    ref={canvasRef}
                    style={{ width: '100%', height: '100%' }}
                />
            </div>
        );
    }
);

HRVPlotCanvas.displayName = 'HRVPlotCanvas';

export default HRVPlotCanvas;
