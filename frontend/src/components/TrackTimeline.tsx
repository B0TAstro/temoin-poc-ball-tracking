/**
 * The timeline bar under the player.
 *
 * It shows, frame by frame, whether the ball was found — which is exactly the
 * question milestone 3 is asking. The gaps are the interesting part: they are
 * what interpolation and tracking will have to fill in later.
 *
 * Hits, bounces and end of point come in milestone 4; the bar is already the
 * place they will be drawn.
 */

import { useEffect, useRef } from 'react'

import type { BallDetection } from '../lib/types'

type Props = {
  /** frame number -> detection, for O(1) lookup */
  track: Map<number, BallDetection>
  totalFrames: number
  currentFrame: number
  /** Click anywhere on the bar to jump there. */
  onSeek: (frame: number) => void
}

const HEIGHT = 44

export function TrackTimeline({ track, totalFrames, currentFrame, onSeek }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || totalFrames === 0) return

    // Draw at the element's real pixel size so it stays crisp.
    const width = canvas.clientWidth
    if (canvas.width !== width) canvas.width = width
    if (canvas.height !== HEIGHT) canvas.height = HEIGHT

    ctx.clearRect(0, 0, width, HEIGHT)

    // Background: the whole clip, as "nothing found".
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(0, 0, width, HEIGHT)

    // One mark per frame where the ball was found. With more frames than
    // pixels, marks overlap and read as a solid band — which is what we want.
    const perFrame = Math.max(width / totalFrames, 1)
    for (const detection of track.values()) {
      const x = (detection.frame / totalFrames) * width
      // Opacity follows confidence, so a weak run is visibly weaker.
      ctx.fillStyle = `rgba(217, 249, 157, ${0.35 + detection.conf * 0.65})`
      ctx.fillRect(x, 0, perFrame, HEIGHT)
    }

    // The playhead.
    const cursorX = (currentFrame / totalFrames) * width
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(cursorX - 1, 0, 2, HEIGHT)
  }, [track, totalFrames, currentFrame])

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || totalFrames === 0) return
    const bounds = canvas.getBoundingClientRect()
    const ratio = (event.clientX - bounds.left) / bounds.width
    onSeek(Math.round(ratio * totalFrames))
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      style={{ height: HEIGHT }}
      className="w-full cursor-pointer rounded-md border border-slate-800"
    />
  )
}
