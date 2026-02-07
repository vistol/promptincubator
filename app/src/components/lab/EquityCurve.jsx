import { useRef, useEffect } from 'react'

/**
 * Lightweight canvas-based equity curve chart
 * Draws a line from equity curve data points
 */
export default function EquityCurve({ data, height = 80, color, showFill = true }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !data || data.length < 2) return

    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1

    // Set canvas size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = height

    // Extract values
    const values = data.map(d => d.equity)
    const minVal = Math.min(...values) * 0.998
    const maxVal = Math.max(...values) * 1.002
    const range = maxVal - minVal || 1

    // Determine color based on final vs initial
    const isPositive = values[values.length - 1] >= values[0]
    const lineColor = color || (isPositive ? '#10b981' : '#ef4444')
    const fillColor = isPositive ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)'

    // Clear
    ctx.clearRect(0, 0, w, h)

    // Draw baseline (initial value)
    const baselineY = h - ((values[0] - minVal) / range) * (h - 4) - 2
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(0, baselineY)
    ctx.lineTo(w, baselineY)
    ctx.stroke()
    ctx.setLineDash([])

    // Draw fill
    if (showFill) {
      ctx.beginPath()
      ctx.moveTo(0, h)
      for (let i = 0; i < values.length; i++) {
        const x = (i / (values.length - 1)) * w
        const y = h - ((values[i] - minVal) / range) * (h - 4) - 2
        ctx.lineTo(x, y)
      }
      ctx.lineTo(w, h)
      ctx.closePath()
      ctx.fillStyle = fillColor
      ctx.fill()
    }

    // Draw line
    ctx.beginPath()
    ctx.strokeStyle = lineColor
    ctx.lineWidth = 1.5
    ctx.lineJoin = 'round'

    for (let i = 0; i < values.length; i++) {
      const x = (i / (values.length - 1)) * w
      const y = h - ((values[i] - minVal) / range) * (h - 4) - 2
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Draw endpoint dot
    const lastX = w
    const lastY = h - ((values[values.length - 1] - minVal) / range) * (h - 4) - 2
    ctx.beginPath()
    ctx.arc(lastX - 2, lastY, 2.5, 0, Math.PI * 2)
    ctx.fillStyle = lineColor
    ctx.fill()

  }, [data, height, color, showFill])

  if (!data || data.length < 2) return null

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: `${height}px` }}
      className="rounded-lg"
    />
  )
}
