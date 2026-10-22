/**
 * Playing an analysed video with its trajectory drawn on top.
 *
 * The link between the two is the frame number: the video knows a time in
 * seconds, the timeline knows frame numbers, and `fps` converts one into the
 * other. That is what the `fps` field of the timeline JSON is for.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  TRAIL_LENGTH,
  clear,
  drawCalls,
  drawCorners,
  drawCourt,
  drawTrack,
  type TrailPoint,
} from './draw'
import type {
  BallDetection,
  CourtLine,
  ImagePoint,
  LineCall,
  Timeline,
} from './types'

/** Playback speeds offered, slow motion first — this is a replay tool. */
export const SPEEDS = [0.1, 0.25, 0.5, 1] as const

type Options = {
  timeline: Timeline | null
  /** The court model projected into the picture, once calibrated. */
  courtLines?: CourtLine[]
  /** Bounces read on the court plane. */
  calls?: LineCall[]
  /** Corners clicked so far, drawn while calibrating. */
  corners?: ImagePoint[]
}

export function useReplayPlayer({
  timeline,
  courtLines = [],
  calls = [],
  corners = [],
}: Options) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)

  const [currentFrame, setCurrentFrame] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<number>(0.25)

  const rafRef = useRef<number | null>(null)

  // frame -> detection, so looking up the current frame is instant. Derived
  // from the timeline rather than kept in state: there is nothing to
  // synchronise, it is just the same data in a faster shape.
  const track = useMemo(() => {
    const built = new Map<number, BallDetection>()
    for (const detection of timeline?.ball_track ?? []) {
      built.set(detection.frame, detection)
    }
    return built
  }, [timeline])

  const fps = timeline?.fps ?? 30
  const totalFrames = timeline ? Math.round(timeline.duration_s * timeline.fps) : 0

  /** Draw the trail ending on `frame`, gaps included. */
  const draw = useCallback((frame: number) => {
    const canvas = overlayRef.current
    const ctx = canvas?.getContext('2d')
    const video = videoRef.current
    if (!ctx || !canvas || !video) return

    // The canvas works in the video's own pixels, so detection coordinates —
    // which are in source-frame pixels — are used as they come.
    if (canvas.width !== video.videoWidth && video.videoWidth) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
    }

    // drawTrack clears first, so the court has to go on top of it. Drawn in
    // this order: trajectory, then court, then the clicked corners, then the
    // bounces, so a line call is never hidden by anything.
    const trail: TrailPoint[] = []
    for (let f = frame - TRAIL_LENGTH + 1; f <= frame; f++) {
      trail.push(f < 0 ? null : (track.get(f) ?? null))
    }
    drawTrack(ctx, trail)
    drawCourt(ctx, courtLines)
    drawCorners(ctx, corners)
    drawCalls(ctx, calls, frame)
  }, [track, courtLines, corners, calls])

  /** Follow the video while it plays, redrawing as the frame changes. */
  const follow = useCallback(
    function loop() {
      rafRef.current = requestAnimationFrame(loop)
      const video = videoRef.current
      if (!video) return

      const frame = Math.floor(video.currentTime * fps)
      setCurrentFrame(frame)
      draw(frame)
    },
    [draw, fps],
  )

  useEffect(() => {
    if (!isPlaying) return
    rafRef.current = requestAnimationFrame(follow)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [isPlaying, follow])

  // Speed applies to the element, and has to be reapplied when it reloads.
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed
  }, [speed, timeline])

  // A new calibration must show up without waiting for the next frame.
  useEffect(() => {
    if (!isPlaying) draw(currentFrame)
  }, [draw, currentFrame, isPlaying])

  const play = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = speed
    await video.play()
    setIsPlaying(true)
  }, [speed])

  const pause = useCallback(() => {
    videoRef.current?.pause()
    setIsPlaying(false)
  }, [])

  /** Jump to a frame and redraw, whether playing or not. */
  const seekToFrame = useCallback(
    (frame: number) => {
      const video = videoRef.current
      if (!video) return
      const clamped = Math.max(0, Math.min(frame, Math.max(totalFrames - 1, 0)))
      // Aim at the middle of the frame: landing exactly on the boundary can
      // show the neighbouring frame instead.
      video.currentTime = (clamped + 0.5) / fps
      setCurrentFrame(clamped)
      draw(clamped)
    },
    [draw, fps, totalFrames],
  )

  /** One frame forward or back. Stepping always pauses first. */
  const step = useCallback(
    (delta: number) => {
      pause()
      seekToFrame(currentFrame + delta)
    },
    [currentFrame, pause, seekToFrame],
  )

  /** Called when a new video is loaded into the element. */
  const reset = useCallback(() => {
    pause()
    setCurrentFrame(0)
    const ctx = overlayRef.current?.getContext('2d')
    if (ctx) clear(ctx)
  }, [pause])

  return {
    videoRef,
    overlayRef,
    track,
    fps,
    totalFrames,
    currentFrame,
    isPlaying,
    speed,
    setSpeed,
    play,
    pause,
    step,
    seekToFrame,
    reset,
  }
}
