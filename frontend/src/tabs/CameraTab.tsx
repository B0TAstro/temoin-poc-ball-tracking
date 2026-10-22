/**
 * Onglet Camera : le suivi en direct.
 *
 * Jalon 1 — la détection est fausse (inventée par le serveur). Ce qu'on
 * regarde ici, c'est que la chaîne tient et combien elle coûte en latence.
 */

import { CameraView } from '../components/CameraView'
import { MetricsPanel } from '../components/MetricsPanel'
import { TARGET_FPS, useBallTracking } from '../lib/useBallTracking'

export function CameraTab() {
  const {
    videoRef,
    captureCanvasRef,
    overlayCanvasRef,
    isRunning,
    error,
    metrics,
    status,
    start,
    stop,
  } = useBallTracking()

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <CameraView
        videoRef={videoRef}
        captureCanvasRef={captureCanvasRef}
        overlayCanvasRef={overlayCanvasRef}
        isRunning={isRunning}
        error={error}
        onStart={start}
        onStop={stop}
      />
      <MetricsPanel metrics={metrics} status={status} targetFps={TARGET_FPS} />
    </div>
  )
}
