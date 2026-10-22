/**
 * The timeline bar under the player.
 *
 * Three things at once, all of them answering "can we trust this?":
 *
 * - where the ball was really detected (bright), and where its position was
 *   filled in between two detections (faint). Guessed is never drawn like
 *   measured.
 * - where the trajectory turns: bounces and hits, read off the path.
 * - where you are in the clip.
 *
 * This is the bar the VAR button will pre-highlight: the point of the whole
 * project is to land the viewer on the disputed moment.
 */

import { useEffect, useRef } from 'react'

import type { BallDetection, Event } from '../lib/types'

type Props = {
  /** frame number -> detection, for O(1) lookup */
  track: Map<number, BallDetection>
  events: Event[]
  totalFrames: number
  currentFrame: number
  /** Click anywhere on the bar to jump there. */
  onSeek: (frame: number) => void
}

const HEIGHT = 56
const BAND_HEIGHT = 30

/** One colour per event type, matching the legend in the tab. */
const EVENT_COLORS: Record<Event['type'], string> = {
  bounce: '#fb7185', // rose
  hit: '#fcd34d', // amber
  point_end: '#a5b4fc', // indigo
}

export function TrackTimeline({
  track,
  events,
  totalFrames,
  currentFrame,
  onSeek,
}: Props) {
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
    ctx.fillRect(0, 0, width, BAND_HEIGHT)

    // One mark per frame of the track. With more frames than pixels, marks
    // overlap and read as a solid band — which is what we want.
    const perFrame = Math.max(width / totalFrames, 1)
    for (const detection of track.values()) {
      const x = (detection.frame / totalFrames) * width
      if (detection.interpolated) {
        // Guessed: faint, and only half the height, so the eye separates it
        // from a real detection without having to read a legend.
        ctx.fillStyle = 'rgba(217, 249, 157, 0.25)'
        ctx.fillRect(x, BAND_HEIGHT / 2, perFrame, BAND_HEIGHT / 2)
      } else {
        // Opacity follows confidence, so a weak run is visibly weaker.
        ctx.fillStyle = `rgba(217, 249, 157, ${0.35 + detection.conf * 0.65})`
        ctx.fillRect(x, 0, perFrame, BAND_HEIGHT)
      }
    }

    // Events, as pins hanging under the band.
    for (const event of events) {
      const x = (event.frame / totalFrames) * width
      ctx.fillStyle = EVENT_COLORS[event.type]
      ctx.globalAlpha = 0.45 + event.conf * 0.55
      ctx.fillRect(x - 1, BAND_HEIGHT, 2, HEIGHT - BAND_HEIGHT - 6)
      ctx.beginPath()
      ctx.arc(x, HEIGHT - 5, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    // The playhead, over everything.
    const cursorX = (currentFrame / totalFrames) * width
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(cursorX - 1, 0, 2, HEIGHT)
  }, [track, events, totalFrames, currentFrame])

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
