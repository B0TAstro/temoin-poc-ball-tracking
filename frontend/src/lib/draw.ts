/**
 * Drawing the ball and its trajectory on the canvas overlaid on the video.
 *
 * The canvas has exactly the same dimensions as the frame sent to the server,
 * so the coordinates we get back are used as is, with no conversion.
 */

import type { BallDetection } from './types'

/** One point of the trail. `null` = a frame where the ball was not seen. */
export type TrailPoint = BallDetection | null

/** How many past positions we keep to draw the trajectory. */
export const TRAIL_LENGTH = 30

const BALL_COLOR = '#d9f99d' // yellow-green, like a tennis ball
const TRAIL_COLOR = '217, 249, 157'

/** Wipe the whole canvas. */
export function clear(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
}

/**
 * Draw the trajectory, then the current ball.
 *
 * The trajectory is a run of segments: every `null` breaks the line, so the
 * frames where detection failed are visible at a glance.
 */
export function drawTrack(ctx: CanvasRenderingContext2D, trail: TrailPoint[]) {
  clear(ctx)

  // --- The trajectory, oldest to newest ---
  for (let i = 1; i < trail.length; i++) {
    const from = trail[i - 1]
    const to = trail[i]
    // A gap on either side: no segment, the line breaks.
    if (!from || !to) continue

    // The more recent the segment, the more opaque and the thicker.
    const age = i / trail.length
    // An interpolated position is a guess: draw it thin and dashed so it never
    // reads as a measurement.
    const guessed = to.interpolated
    ctx.strokeStyle = `rgba(${TRAIL_COLOR}, ${(0.15 + age * 0.65) * (guessed ? 0.5 : 1)})`
    ctx.lineWidth = guessed ? 1 : 1 + age * 2
    ctx.setLineDash(guessed ? [4, 4] : [])
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // --- The current ball ---
  const current = trail[trail.length - 1]
  if (!current) return

  if (current.interpolated) {
    // Guessed: an empty circle, so it is obviously not a detection.
    ctx.beginPath()
    ctx.arc(current.x, current.y, 6, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(${TRAIL_COLOR}, 0.7)`
    ctx.lineWidth = 1.5
    ctx.setLineDash([3, 3])
    ctx.stroke()
    ctx.setLineDash([])
    return
  }

  ctx.beginPath()
  ctx.arc(current.x, current.y, 7, 0, Math.PI * 2)
  ctx.fillStyle = BALL_COLOR
  ctx.fill()

  // A ring around it, its opacity following the detection confidence.
  ctx.beginPath()
  ctx.arc(current.x, current.y, 13, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(${TRAIL_COLOR}, ${current.conf})`
  ctx.lineWidth = 2
  ctx.stroke()

  // The confidence as a number, right next to it.
  ctx.font = '12px monospace'
  ctx.fillStyle = BALL_COLOR
  ctx.fillText(current.conf.toFixed(2), current.x + 18, current.y + 4)
}
