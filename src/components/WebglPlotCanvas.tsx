// components/WebglPlotCanvas.tsx
'use client'
import { useEffect, useRef } from 'react'
import { WebglPlot, WebglLine, ColorRGBA } from 'webgl-plot'

type Props = {
  /** your stream: [{ ch0: 0.1, ch1: -0.2 }, …] */
  data: Array<Record<string, number>>
  /** e.g. ['ch0','ch1'] */
  channels: string[]
  /** e.g. { ch0: '#C29963', ch1: '#548687' } */
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

  // 1️⃣ Resize handler: measure CSS size → set drawing buffer & viewport
  useEffect(() => {
    const canvas = canvasRef.current!
    const handleResize = () => {
      const { width, height } = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = width * dpr
      canvas.height = height * dpr
      if (wglpRef.current) {
        wglpRef.current.gl.viewport(0, 0, canvas.width, canvas.height)
      }
    }
    window.addEventListener('resize', handleResize)
    handleResize()  // initial
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // 2️⃣ On mount (or if channels/data‑length change): init WebglPlot & lines
  useEffect(() => {
    const canvas = canvasRef.current!
    const wglp = new WebglPlot(canvas)
    wglpRef.current = wglp

    const n = data.length
    channels.forEach(ch => {
      const color = hexToColorRGBA(colors[ch])
      const line = new WebglLine(color, n)
      line.lineSpaceX(-1, 2 / (n - 1))
      linesRef.current[ch] = line
      wglp.addLine(line)
    })

    return () => {
      wglpRef.current = undefined
      linesRef.current = {}
    }
  }, [channels.join(','), data.length])

  // 3️⃣ On every data update: copy into each line, then draw
  useEffect(() => {
    const wglp = wglpRef.current
    if (!wglp) return
    const n = data.length
    channels.forEach(ch => {
      const line = linesRef.current[ch]
      for (let i = 0; i < n; i++) {
        line.setY(i, data[i][ch] ?? 0)
      }
    })
    wglp.update()
  }, [data])

  // fill parent container
  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
