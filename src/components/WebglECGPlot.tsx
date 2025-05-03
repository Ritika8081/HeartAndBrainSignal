'use client';

import { useEffect, useRef } from 'react';
import { WebglPlot, WebglLine, ColorRGBA } from 'webgl-plot';
import type { ECGDataEntry } from '@/components/Bledata';

const DATA_LENGTH = 512;

export function WebglECGPlot({ ecgData }: { ecgData: ECGDataEntry[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const plotRef   = useRef<WebglPlot | null>(null);   // ← null initial
  const lineRef   = useRef<WebglLine | null>(null);   // ← null initial
  const writePos  = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const plot = new WebglPlot(canvas);
    plotRef.current = plot;

    const color = new ColorRGBA(0, 0, 1, 1);
    const line = new WebglLine(color, DATA_LENGTH);
    line.lineSpaceX(-1, 2 / DATA_LENGTH);
    line.offsetY = 0;
    plot.addLine(line);
    lineRef.current = line;

    let id: number;
    const render = () => {
      plot.update();
      id = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const line = lineRef.current;
    if (!line) return;

    ecgData.forEach(entry => {
      const pos = writePos.current % DATA_LENGTH;
      line.setY(pos, entry.ch2);
      const next = (pos + 1) % DATA_LENGTH;
      line.setY(next, NaN);
      writePos.current++;
    });
  }, [ecgData]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-56 rounded-lg border"
    />
  );
}
