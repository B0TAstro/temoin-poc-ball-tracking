/**
 * Drawing the ball and its trajectory on the canvas overlaid on the video.
 *
 * The canvas has exactly the same dimensions as the frame sent to the server,
 * so the coordinates we get back are used as is, with no conversion.
 */

import type {
  BallDetection,
  CourtLine,
  ImagePoint,
  LineCall,
} from './types'

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

// --- The court, once calibrated ---

const COURT_COLOR = 'rgba(125, 211, 252, 0.75)' // sky
const NET_COLOR = 'rgba(232, 121, 249, 0.8)' // fuchsia

/** One colour per verdict, matching the legend. */
const VERDICT_COLORS: Record<LineCall['verdict'], string> = {
  in: '#86efac', // green
  out: '#fca5a5', // red
  too_close: '#fcd34d', // amber
}

/**
 * Draw the court model projected back into the picture.
 *
 * This is the calibration's own proof: if these lines land on the painted
 * ones, the four corners were clicked right. Letting the eye confirm it beats
 * trusting a number — and in the app it is what lets a player accept the
 * reading instead of taking it on faith.
 */
export function drawCourt(ctx: CanvasRenderingContext2D, lines: CourtLine[]) {
  for (const line of lines) {
    const [[x1, y1], [x2, y2]] = line.points
    ctx.strokeStyle = line.name === 'net' ? NET_COLOR : COURT_COLOR
    ctx.lineWidth = line.name === 'net' ? 2 : 1.5
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
}

/** The corners clicked so far, numbered in the order they were given. */
export function drawCorners(ctx: CanvasRenderingContext2D, corners: ImagePoint[]) {
  corners.forEach((corner, index) => {
    ctx.beginPath()
    ctx.arc(corner.x, corner.y, 9, 0, Math.PI * 2)
    ctx.strokeStyle = '#fb923c'
    ctx.lineWidth = 3
    ctx.stroke()

    ctx.font = 'bold 15px monospace'
    ctx.fillStyle = '#fb923c'
    ctx.fillText(String(index + 1), corner.x + 13, corner.y + 5)
  })
}

/**
 * Mark a bounce on the court with how far inside or outside it landed.
 *
 * Only drawn when the player is near it in time, otherwise every bounce of the
 * point would be on screen at once.
 */
export function drawCalls(
  ctx: CanvasRenderingContext2D,
  calls: LineCall[],
  currentFrame: number,
  window = 45,
) {
  for (const call of calls) {
    const distance = Math.abs(call.frame - currentFrame)
    if (distance > window) continue

    const fade = 1 - distance / window
    const colour = VERDICT_COLORS[call.verdict]

    ctx.globalAlpha = 0.25 + fade * 0.75
    ctx.beginPath()
    ctx.arc(call.image_x, call.image_y, 15, 0, Math.PI * 2)
    ctx.strokeStyle = colour
    ctx.lineWidth = 3
    ctx.stroke()

    // The margin in metres, and the uncertainty that goes with it. Never one
    // without the other: a margin alone reads as a verdict.
    ctx.font = 'bold 15px monospace'
    ctx.fillStyle = colour
    const sign = call.margin_m >= 0 ? '+' : ''
    ctx.fillText(
      `${sign}${call.margin_m.toFixed(2)} ±${call.uncertainty_m.toFixed(2)} m`,
      call.image_x + 22,
      call.image_y + 5,
    )
    ctx.globalAlpha = 1
  }
}
