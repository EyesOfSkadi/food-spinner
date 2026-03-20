'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { Restaurant } from '@/types'

const COLORS = [
  '#E53E3E', '#DD6B20', '#D69E2E', '#38A169', '#319795',
  '#3182CE', '#805AD5', '#D53F8C', '#C05621', '#2C7A7B',
  '#2B6CB0', '#6B46C1', '#97266D', '#276749', '#744210',
  '#1A365D', '#44337A', '#702459', '#1C4532', '#553C9A',
  '#9B2335', '#B7791F', '#276749', '#2A4365', '#44337A',
]

interface Props {
  restaurants: Restaurant[]
  onSpinEnd: () => void
}

export default function SpinWheel({ restaurants, onSpinEnd }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rotationRef = useRef(0)
  const isSpinningRef = useRef(false)
  const [spinning, setSpinning] = useState(false)
  const [winnerName, setWinnerName] = useState('')

  const drawWheel = useCallback(
    (rot: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const size = canvas.width
      const cx = size / 2
      const cy = size / 2
      const r = cx - 15
      const n = restaurants.length
      if (n === 0) {
        ctx.clearRect(0, 0, size, size)
        return
      }

      const segAngle = (2 * Math.PI) / n
      ctx.clearRect(0, 0, size, size)

      // Outer glow
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.25)'
      ctx.shadowBlur = 20
      ctx.beginPath()
      ctx.arc(cx, cy, r + 4, 0, 2 * Math.PI)
      ctx.fillStyle = '#fff'
      ctx.fill()
      ctx.restore()

      // Segments
      for (let i = 0; i < n; i++) {
        const start = rot + i * segAngle
        const end = rot + (i + 1) * segAngle
        const mid = rot + (i + 0.5) * segAngle

        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.arc(cx, cy, r, start, end)
        ctx.closePath()
        ctx.fillStyle = COLORS[i % COLORS.length]
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'
        ctx.lineWidth = 2
        ctx.stroke()

        // Text
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(mid)
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = '#fff'
        const fontSize = Math.max(8, Math.min(13, r * 0.085))
        ctx.font = `bold ${fontSize}px 'Segoe UI', Arial, sans-serif`
        ctx.shadowColor = 'rgba(0,0,0,0.6)'
        ctx.shadowBlur = 3

        let name = restaurants[i].name
        // Truncate based on available space
        const maxChars = Math.max(8, Math.floor(r * 0.085))
        if (name.length > maxChars) name = name.slice(0, maxChars - 1) + '…'
        ctx.fillText(name, r - 10, 0)
        ctx.restore()
      }

      // Outer border ring
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, 2 * Math.PI)
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 5
      ctx.stroke()

      // Center circle gradient
      const innerR = r * 0.18
      ctx.beginPath()
      ctx.arc(cx, cy, innerR, 0, 2 * Math.PI)
      const grad = ctx.createRadialGradient(
        cx - innerR * 0.3,
        cy - innerR * 0.3,
        0,
        cx,
        cy,
        innerR
      )
      grad.addColorStop(0, '#ffffff')
      grad.addColorStop(1, '#e2e8f0')
      ctx.fillStyle = grad
      ctx.fill()
      ctx.strokeStyle = '#cbd5e0'
      ctx.lineWidth = 2
      ctx.stroke()

      // Center icon
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `${innerR * 1.1}px Arial`
      ctx.shadowBlur = 0
      ctx.fillText('🍽️', cx, cy)
    },
    [restaurants]
  )

  useEffect(() => {
    drawWheel(rotationRef.current)
  }, [restaurants, drawWheel])

  const spin = useCallback(() => {
    if (isSpinningRef.current || restaurants.length === 0) return

    isSpinningRef.current = true
    setSpinning(true)
    setWinnerName('')

    const n = restaurants.length
    const segAngle = (2 * Math.PI) / n
    const winnerIdx = Math.floor(Math.random() * n)

    // Pointer is at LEFT side (9 o'clock = π radians in canvas coords)
    // We want: rot_final + (winnerIdx + 0.5) * segAngle ≡ π (mod 2π)
    const pointerAngle = Math.PI
    const idealRot = pointerAngle - (winnerIdx + 0.5) * segAngle
    const idealNorm = ((idealRot % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
    const currentNorm = ((rotationRef.current % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
    let delta = idealNorm - currentNorm
    if (delta < 0) delta += 2 * Math.PI

    const fullSpins = (5 + Math.floor(Math.random() * 6)) * 2 * Math.PI
    const targetRot = rotationRef.current + fullSpins + delta
    const startRot = rotationRef.current
    const duration = 4000 + Math.random() * 2000

    let startTime: number | null = null
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 4)

    const animate = (timestamp: number) => {
      if (startTime === null) startTime = timestamp
      const elapsed = timestamp - startTime
      const progress = Math.min(elapsed / duration, 1)
      const currentRot = startRot + (targetRot - startRot) * easeOut(progress)

      rotationRef.current = currentRot
      drawWheel(currentRot)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        rotationRef.current = targetRot
        isSpinningRef.current = false
        setSpinning(false)
        setWinnerName(restaurants[winnerIdx].name)
        onSpinEnd()
      }
    }

    requestAnimationFrame(animate)
  }, [restaurants, drawWheel, onSpinEnd])

  return (
    <div className="wheel-container">
      <div className="wheel-wrapper">
        <div className="pointer" title="Mũi tên chỉ vào quán được chọn">▶</div>
        <canvas
          ref={canvasRef}
          width={420}
          height={420}
          className="wheel-canvas"
          onClick={!spinning ? spin : undefined}
          style={{ cursor: spinning ? 'default' : 'pointer' }}
          title={spinning ? '' : 'Click để quay'}
        />
      </div>

      <button onClick={spin} disabled={spinning || restaurants.length === 0} className="btn-spin">
        {spinning ? '🌀 Đang quay...' : '🎯 Quay ngay!'}
      </button>

      {winnerName && !spinning && (
        <div className="winner-banner">🎉 {winnerName}</div>
      )}
    </div>
  )
}
