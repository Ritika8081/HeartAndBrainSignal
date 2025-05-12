// components/WebglPlotCanvas.tsx
'use client'
import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { WebglPlot, WebglLine, ColorRGBA } from 'webgl-plot'


export type WebglPlotCanvasHandle = {
  /** Get the WebGL context */
  getContext: () => WebGLRenderingContext | null
  /** Get the current WebglPlot instance */
  getPlot: () => WebglPlot | null
  /** Force a redraw of the plot */
  redraw: () => void
  /** Get the canvas element */
  getCanvas: () => HTMLCanvasElement | null
  
  updateData: (channeldata: number[]) => void // <-- ADD THIS

}

function hexToColorRGBA(hex: string): ColorRGBA {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return new ColorRGBA(r, g, b, 1)
}

// Define the Props type
type Props = {
 
  channels: number[]
  colors: Record<number, string>
  counter: number
}

const WebglPlotCanvas = forwardRef<WebglPlotCanvasHandle, Props>(
  ({ channels, colors, counter }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const wglpRef = useRef<WebglPlot | null>(null)
    const linesRef = useRef<Record<string, WebglLine>>({})
    const sweepRef = useRef(0)

    useImperativeHandle(
      ref,
      () => ({
        getContext: () => canvasRef.current?.getContext('webgl') || null,
        getPlot: () => wglpRef.current,
        redraw: () => wglpRef.current?.update(),
        getCanvas: () => canvasRef.current,
        updateData: (channeldata: number[]) => {
          const ch = channels[0]; // use correct channel key
          const line = linesRef.current[ch];
          const n = line?.numPoints ?? 0;
          if (!line || n === 0) return;
    
          const idx = sweepRef.current;

          const val = channeldata[1]; // Adjust if your data format is different
    
          line.setY(idx, val);
    
          sweepRef.current = (idx + 1) % n;
    
          wglpRef.current?.update();
        }
      }),
      [channels] // should depend on channels
    )
    
    
    // 1) ResizeObserver effect to match container size
    useEffect(() => {
      const canvas = canvasRef.current!
      const onResize = () => {
        const { width, height } = canvas.getBoundingClientRect()
        const dpr = window.devicePixelRatio || 1
        canvas.width = width * dpr
        canvas.height = height * dpr
        const gl = canvas.getContext('webgl')
        if (gl) gl.viewport(0, 0, canvas.width, canvas.height)
        wglpRef.current?.update()
      }

      const ro = new ResizeObserver(onResize)
      ro.observe(canvas)
      // Initial sizing
      onResize()

      return () => ro.disconnect()
    }, [])


    // Initialize plot & lines on channel list or data length change
    useEffect(() => {

      const canvas = canvasRef.current!
      const wglp = new WebglPlot(canvas)
      wglpRef.current = wglp
      linesRef.current = {}

      channels.forEach((ch:number) => {
        const line = new WebglLine(hexToColorRGBA(colors[ch]), 2000)
        line.lineSpaceX(-1, 2 / 2000)
      
        // **NEW**: mark every sample as “no data”:
        for (let i = 0; i < line.numPoints; i++) {
          line.setY(i, NaN)
        }
      
        linesRef.current[ch] = line
        wglp.addLine(line)
      })
      
      wglp.update()
      sweepRef.current = 0

      return () => {
        wglpRef.current = null
        linesRef.current = {}
      }
    }, [])

    return (
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    )
  }
)

WebglPlotCanvas.displayName = 'WebglPlotCanvas'

export default WebglPlotCanvas