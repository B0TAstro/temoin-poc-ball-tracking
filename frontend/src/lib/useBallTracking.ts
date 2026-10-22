/**
 * All the logic of the Camera tab: open the camera, grab frames, send them to
 * the server, draw the detections, count the performance figures.
 *
 * Components only display; everything that moves lives here.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { TRAIL_LENGTH, clear, drawTrack, type TrailPoint } from './draw'
import { EMPTY_METRICS, type DetectResponse, type Metrics } from './types'
import { useDetectionSocket } from './useDetectionSocket'

/** The width we scale frames down to before sending them. */
export const CAPTURE_WIDTH = 640

/** Target frame rate. Deliberately low: we measure, we do not optimise yet. */
export const TARGET_FPS = 15

/** JPEG quality. A trade-off between network weight and readability. */
const JPEG_QUALITY = 0.6

export function useBallTracking() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null) // hidden
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null) // visible

  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<Metrics>(EMPTY_METRICS)

  // The recent trail. In a ref: it changes on every frame and we do not want a
  // React render each time, the drawing happens in the canvas.
  const trailRef = useRef<TrailPoint[]>([])
  const frameIdRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lastCaptureRef = useRef(0)

  // Counters for frames per second, reset every second.
  const countersRef = useRef({ captured: 0, processed: 0, since: 0 })
  // Totals, which are not reset.
  const totalsRef = useRef({ frames: 0, missed: 0 })

  /** Called on every server answer: draw, then refresh the figures. */
  const handleDetection = useCallback(
    (response: DetectResponse, roundTripMs: number) => {
      countersRef.current.processed++
      totalsRef.current.frames++
      if (!response.detection) totalsRef.current.missed++

      // Push the position (or the gap) and keep the last N.
      const trail = [...trailRef.current, response.detection].slice(-TRAIL_LENGTH)
      trailRef.current = trail

      const ctx = overlayCanvasRef.current?.getContext('2d')
      if (ctx) drawTrack(ctx, trail)

      setMetrics((previous) => ({
        ...previous,
        roundTripMs,
        decodeMs: response.decode_ms,
        inferenceMs: response.inference_ms,
        detector: response.detector,
        lastConf: response.detection?.conf ?? null,
        missedFrames: totalsRef.current.missed,
        totalFrames: totalsRef.current.frames,
      }))
    },
    [],
  )

  const { status, send } = useDetectionSocket({ onDetection: handleDetection })

  /** The capture loop: at most one frame every 1/TARGET_FPS seconds. */
  // A named function (`loop`) so it can reschedule itself without referencing
  // its own binding before initialisation.
  const captureLoop = useCallback(
    function loop(now: number) {
      rafRef.current = requestAnimationFrame(loop)

      // Refresh the frames-per-second figures, once a second.
      const counters = countersRef.current
      if (now - counters.since >= 1000) {
        const elapsed = (now - counters.since) / 1000
        const capturedFps = counters.captured / elapsed
        const processedFps = counters.processed / elapsed
        counters.captured = 0
        counters.processed = 0
        counters.since = now
        setMetrics((previous) => ({ ...previous, capturedFps, processedFps }))
      }

      const interval = 1000 / TARGET_FPS
      if (now - lastCaptureRef.current < interval) return

      const video = videoRef.current
      const canvas = captureCanvasRef.current
      if (!video || !canvas || video.readyState < 2) return

      // Set the capture size from the camera's actual aspect ratio.
      const ratio = video.videoHeight / video.videoWidth
      const width = CAPTURE_WIDTH
      const height = Math.round(CAPTURE_WIDTH * ratio)
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
        const overlay = overlayCanvasRef.current
        if (overlay) {
          overlay.width = width
          overlay.height = height
        }
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(video, 0, 0, width, height)

      const sent = send({
        frame_id: frameIdRef.current,
        image: canvas.toDataURL('image/jpeg', JPEG_QUALITY),
        width,
        height,
      })

      // If the send was refused (previous answer not back yet) we do not count
      // the frame: the displayed rate stays honest.
      if (sent) {
        frameIdRef.current++
        counters.captured++
        lastCaptureRef.current = now
      }
    },
    [send],
  )

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 } },
        audio: false,
      })
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()

      // Reset every counter for this session.
      trailRef.current = []
      frameIdRef.current = 0
      totalsRef.current = { frames: 0, missed: 0 }
      countersRef.current = { captured: 0, processed: 0, since: performance.now() }
      lastCaptureRef.current = 0
      setMetrics(EMPTY_METRICS)

      setIsRunning(true)
      rafRef.current = requestAnimationFrame(captureLoop)
    } catch (caught) {
      // Permission denied, or no camera available.
      // Message shown to the user, hence in French.
      setError(
        caught instanceof Error ? caught.message : "la caméra n'a pas pu s'ouvrir",
      )
    }
  }, [captureLoop])

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null

    const video = videoRef.current
    const stream = video?.srcObject as MediaStream | null
    stream?.getTracks().forEach((track) => track.stop())
    if (video) video.srcObject = null

    const ctx = overlayCanvasRef.current?.getContext('2d')
    if (ctx) clear(ctx)

    setIsRunning(false)
  }, [])

  // Leaving the tab releases the camera: no indicator light left on.
  useEffect(() => stop, [stop])

  return {
    videoRef,
    captureCanvasRef,
    overlayCanvasRef,
    isRunning,
    error,
    metrics,
    status,
    start,
    stop,
  }
}
