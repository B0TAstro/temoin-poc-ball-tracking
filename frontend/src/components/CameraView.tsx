/**
 * The camera picture, with the drawing canvas laid over it.
 *
 * This component holds no logic: it takes the refs and handlers from
 * `useBallTracking` and just places them on screen.
 */

import type { RefObject } from 'react'

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>
  captureCanvasRef: RefObject<HTMLCanvasElement | null>
  overlayCanvasRef: RefObject<HTMLCanvasElement | null>
  isRunning: boolean
  error: string | null
  onStart: () => void
  onStop: () => void
}

export function CameraView({
  videoRef,
  captureCanvasRef,
  overlayCanvasRef,
  isRunning,
  error,
  onStart,
  onStop,
}: Props) {
  return (
    <div className="space-y-3">
      {/* Video and canvas overlap exactly, pixel for pixel. */}
      <div className="relative overflow-hidden rounded-lg border border-slate-800 bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className="block w-full"
          // Reserve some height until the camera starts.
          style={{ minHeight: isRunning ? undefined : 320 }}
        />
        <canvas
          ref={overlayCanvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
        {!isRunning && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
            Caméra arrêtée
          </div>
        )}
      </div>

      {/* Working canvas: scales the frame down before sending, never displayed. */}
      <canvas ref={captureCanvasRef} className="hidden" />

      <div className="flex items-center gap-3">
        <button
          onClick={isRunning ? onStop : onStart}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            isRunning
              ? 'bg-red-500/15 text-red-300 hover:bg-red-500/25'
              : 'bg-lime-300 text-slate-950 hover:bg-lime-200'
          }`}
        >
          {isRunning ? 'Arrêter' : 'Démarrer la caméra'}
        </button>
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </div>
  )
}
