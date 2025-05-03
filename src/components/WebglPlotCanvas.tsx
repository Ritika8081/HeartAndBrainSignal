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
}

function hexToColorRGBA(hex: string): ColorRGBA {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return new ColorRGBA(r, g, b, 1)
}

export default function WebglPlotCanvas({ data, channels, colors }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wglpRef = useRef<WebglPlot>()
  const linesRef = useRef<Record<string, WebglLine>>({})
  const sweepRef = useRef(0)

  // ─── 1) Resize → sync drawingBuffer & viewport ─────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current!
    const onResize = () => {
      const { width, height } = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = width * dpr
      canvas.height = height * dpr
      if (wglpRef.current) {
        wglpRef.current.gl.viewport(0, 0, canvas.width, canvas.height)
      }
    }
    window.addEventListener('resize', onResize)
    onResize()
    return () => void window.removeEventListener('resize', onResize)
  }, [])

  // ─── 2) Initialize plot & lines whenever channel‑list or buffer‑length changes ─
  useEffect(() => {
    const n = data.length/2
    if (n === 0) return         // ← guard empty buffer

    const canvas = canvasRef.current!
    const wglp = new WebglPlot(canvas)
    wglpRef.current = wglp
    linesRef.current = {}

    // create a line per channel
    channels.forEach((ch) => {
      const line = new WebglLine(hexToColorRGBA(colors[ch]), n)
      line.lineSpaceX(-1, 2 / (n - 1))  // map indices 0…n−1 → x=−1…+1
      linesRef.current[ch] = line
      wglp.addLine(line)
    })

    // if you already have data, draw full static trace once
    channels.forEach((ch) => {
      const line = linesRef.current[ch]!
      for (let i = 0; i < n; i++) {
        line.setY(i, data[i][ch] ?? 0)
      }
    })
    // auto‑scale Y so peak occupies ~90% height
    const maxAbs = data.reduce((m, pt) =>
      Math.max(m, ...channels.map(ch => Math.abs(pt[ch] ?? 0)))
    , 0)
    if (maxAbs > 0) wglp.gScaleY = 0.9 / maxAbs

    wglp.update()
    sweepRef.current = 0       // start sweep at left

    return () => {
      wglpRef.current = undefined
      linesRef.current = {}
    }
  }, [channels.join(','), data.length])

  // ─── 3) On every data update: write only the new sample at sweepPos ──────────
  useEffect(() => {
    const wglp = wglpRef.current
    const n = data.length
    if (!wglp || n === 0) return  // ← guard empty or uninitialized

    const latest = data[n - 1]
    const idx = sweepRef.current

    // update one point per channel
    channels.forEach((ch) => {
      const line = linesRef.current[ch]
      if (line) line.setY(idx, latest[ch] ?? 0)
    })

    // auto‑scale if needed
    const maxAbs = data.reduce((m, pt) =>
      Math.max(m, ...channels.map(ch => Math.abs(pt[ch] ?? 0)))
    , 0)
    if (maxAbs > 0) wglp.gScaleY = 0.9 / maxAbs

    wglp.update()
    sweepRef.current = (idx + 1) % n
  }, [data])

  // ─── 4) Render a full‑width, full‑height canvas ─────────────────────────────
  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
