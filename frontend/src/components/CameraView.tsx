/**
 * L'image de la caméra, avec le canvas de dessin superposé par-dessus.
 *
 * Ce composant n'a aucune logique : il reçoit les refs et les boutons de
 * `useBallTracking` et se contente de les placer à l'écran.
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
      {/* La vidéo et le canvas se superposent exactement, au pixel près. */}
      <div className="relative overflow-hidden rounded-lg border border-slate-800 bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className="block w-full"
          // Hauteur réservée tant que la caméra n'est pas lancée.
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

      {/* Canvas de travail : sert à réduire l'image avant l'envoi, jamais affiché. */}
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
