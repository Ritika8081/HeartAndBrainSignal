// components/WebglPlotCanvas.tsx
'use client'
import { useEffect, useRef } from 'react'
import { WebglPlot, WebglLine, ColorRGBA } from 'webgl-plot'

type Props = {
  /** your full history buffer, e.g. [{ ch0:0.1, ch1:-0.2 }, …] */
  data: Array<Record<string, number>>
  /** which channels to draw, e.g. ['ch0','ch1'] */
  channels: string[]
  /** color lookup, e.g. { ch0:'#C29963', ch1:'#548687' } */
  colors: Record<string, string>
  counter: number[];
}

const hexToColorRGBA = (hex: string): ColorRGBA => {
  if (!hex || hex.length !== 7) {
    console.warn("Invalid hex color:", hex);
    hex = "#000000"; // Fallback to black
  }

  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const a = 1.0; // Fully opaque
  return { r, g, b, a };
};

export default function WebglPlotCanvas({ data, channels, colors, counter }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wglpRef = useRef<WebglPlot | null>(null)
  const linesRef = useRef<Record<string, WebglLine>>({})
  const sweepRef = useRef(0)

  // 1) ResizeObserver effect to match container size
  useEffect(() => {
    const canvas = canvasRef.current!;
    const onResize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      const gl = canvas.getContext('webgl');
      if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);
    // Initial sizing
    onResize();

    return () => ro.disconnect();
  }, []);

  if (counter.length > 0) {
    console.log("Counter data:", counter);
  }

  useEffect(() => {
    if (data.length > 0) {
      const latest = data[data.length - 1]
      console.log("Data received:", latest)
      console.log("ECG Data (ch2):", latest.ch2)
    }
  }, [data])

  // Initialize plot & lines on channel list or data length change
  useEffect(() => {
    const n = data.length;
    if (n === 0) return

    const canvas = canvasRef.current!
    const wglp = new WebglPlot(canvas)
    wglpRef.current = wglp
    linesRef.current = {}

    // create line for each channel
    channels.forEach((ch) => {
      const line = new WebglLine(hexToColorRGBA(colors[ch]), n)
      line.lineSpaceX(-1, 2 / (n - 1))  // map indices to x=−1…+1
      linesRef.current[ch] = line
      wglp.addLine(line)
    })

    wglp.update()
    sweepRef.current = 0

    return () => {
      wglpRef.current = null
      linesRef.current = {}
    }
  }, [channels.join(','), data.length])

  // Update latest point on new data
  // ── Auto-gain normalization & plotting ──
  useEffect(() => {
    const wglp = wglpRef.current
    const n = data.length
    if (!wglp || n === 0) return

    // 1️ Build per-channel windows:
    const windows: Record<string, number[]> = {}
    channels.forEach(ch => {
      windows[ch] = data.map(pt => pt[ch] ?? 0)
    })

    // 2️ Compute each channel’s max absolute value:
    const maxAbs: Record<string, number> = {}
    channels.forEach(ch => {
      const arr = windows[ch]
      const m = Math.max(...arr.map(v => Math.abs(v)), 1e-6)
      maxAbs[ch] = m
    })

    // 3️ Set each line’s gain so ±maxAbs→±1 in clip-space
    channels.forEach((ch, i) => {
      const line = linesRef.current[ch]
      if (line) {
        // You can either set gScaleY per-plot (if you kept one WebglPlot per channel),
        // or tweak per-line via dividing your raw sample below:
        // Here we’ll just divide the raw sample when calling setY:
        const idx = sweepRef.current
        const raw = data[idx][ch] ?? 0
        const norm = raw / maxAbs[ch]   // now guaranteed in [-1..1]
        line.setY(idx, norm)
      }
    })

    wglp.update()
    sweepRef.current = (sweepRef.current + 1) % n
  }, [data])



  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
