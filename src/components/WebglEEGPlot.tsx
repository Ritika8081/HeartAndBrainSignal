'use client';

import { useEffect, useRef } from 'react';
import { WebglPlot, WebglLine, ColorRGBA } from 'webgl-plot';
import type { EEGDataEntry } from '@/components/Bledata';

const DATA_LENGTH = 512;  // buffer size

export function WebglEEGPlot({ eegData }: { eegData: EEGDataEntry[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const plotRef   = useRef<WebglPlot | null>(null);    // ← initialize with null
  const linesRef  = useRef<WebglLine[]>([]);           // ← initialize with empty array
  const writePos  = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // …same initialization…
    const plot = new WebglPlot(canvas);
    plotRef.current = plot;

    const colors = [
      new ColorRGBA(1, 0, 0, 1),
      new ColorRGBA(0, 1, 0, 1),
    ];
    const lines = colors.map((c, i) => {
      const line = new WebglLine(c, DATA_LENGTH);
      line.lineSpaceX(-1, 2 / DATA_LENGTH);
      line.offsetY = i * 0.5 - 0.5;
      plot.addLine(line);
      return line;
    });
    linesRef.current = lines;

    let id: number;
    const render = () => {
      plot.update();
      id = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const lines = linesRef.current;
    if (!lines.length) return;

    eegData.forEach(entry => {
      const pos = writePos.current % DATA_LENGTH;
      lines[0].setY(pos, entry.ch0);
      lines[1].setY(pos, entry.ch1);
      const next = (pos + 1) % DATA_LENGTH;
      lines.forEach(l => l.setY(next, NaN));
      writePos.current++;
    });
  }, [eegData]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-56 rounded-lg border"
    />
  );
}
