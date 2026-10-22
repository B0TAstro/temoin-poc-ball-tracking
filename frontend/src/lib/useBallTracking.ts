/**
 * Toute la logique de l'onglet Camera : ouvrir la caméra, extraire les images,
 * les envoyer au serveur, dessiner les détections, compter les performances.
 *
 * Les composants ne font que de l'affichage ; tout ce qui bouge est ici.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { TRAIL_LENGTH, clear, drawTrack, type TrailPoint } from './draw'
import { EMPTY_METRICS, type DetectResponse, type Metrics } from './types'
import { useDetectionSocket } from './useDetectionSocket'

/** Largeur à laquelle on réduit l'image avant de l'envoyer. */
export const CAPTURE_WIDTH = 640

/** Cadence visée. Volontairement basse : on mesure, on n'optimise pas encore. */
export const TARGET_FPS = 15

/** Qualité du JPEG. Compromis entre poids sur le réseau et lisibilité. */
const JPEG_QUALITY = 0.6

export function useBallTracking() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null) // caché
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null) // visible

  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<Metrics>(EMPTY_METRICS)

  // La trajectoire récente. Dans une ref : elle change à chaque image, on ne
  // veut pas un rendu React à chaque fois, le dessin se fait dans le canvas.
  const trailRef = useRef<TrailPoint[]>([])
  const frameIdRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lastCaptureRef = useRef(0)

  // Compteurs pour les images par seconde, remis à zéro chaque seconde.
  const countersRef = useRef({ captured: 0, processed: 0, since: 0 })
  // Totaux, qui eux ne sont pas remis à zéro.
  const totalsRef = useRef({ frames: 0, missed: 0 })

  /** Appelé à chaque réponse du serveur : on dessine et on met à jour les chiffres. */
  const handleDetection = useCallback(
    (response: DetectResponse, roundTripMs: number) => {
      countersRef.current.processed++
      totalsRef.current.frames++
      if (!response.detection) totalsRef.current.missed++

      // On empile la position (ou le trou) et on garde les N dernières.
      const trail = [...trailRef.current, response.detection].slice(-TRAIL_LENGTH)
      trailRef.current = trail

      const ctx = overlayCanvasRef.current?.getContext('2d')
      if (ctx) drawTrack(ctx, trail)

      setMetrics((previous) => ({
        ...previous,
        roundTripMs,
        inferenceMs: response.inference_ms,
        lastConf: response.detection?.conf ?? null,
        missedFrames: totalsRef.current.missed,
        totalFrames: totalsRef.current.frames,
      }))
    },
    [],
  )

  const { status, send } = useDetectionSocket({ onDetection: handleDetection })

  /** La boucle de capture : une image toutes les 1/TARGET_FPS secondes au plus. */
  // Fonction nommée (`loop`) pour qu'elle puisse se replanifier elle-même
  // sans se référencer avant d'être initialisée.
  const captureLoop = useCallback(
    function loop(now: number) {
      rafRef.current = requestAnimationFrame(loop)

      // Mise à jour des images par seconde, une fois par seconde.
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

      // On fixe les dimensions de capture à partir du format réel de la caméra.
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

      // Si l'envoi a été refusé (réponse précédente pas encore revenue), on ne
      // compte pas l'image : la cadence affichée reste honnête.
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

      // Remise à zéro de tous les compteurs pour cette session.
      trailRef.current = []
      frameIdRef.current = 0
      totalsRef.current = { frames: 0, missed: 0 }
      countersRef.current = { captured: 0, processed: 0, since: performance.now() }
      lastCaptureRef.current = 0
      setMetrics(EMPTY_METRICS)

      setIsRunning(true)
      rafRef.current = requestAnimationFrame(captureLoop)
    } catch (caught) {
      // Refus de l'autorisation, ou pas de caméra disponible.
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

  // Si on quitte l'onglet, on relâche la caméra : pas de voyant qui reste allumé.
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
