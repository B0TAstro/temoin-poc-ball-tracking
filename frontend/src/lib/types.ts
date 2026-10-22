/**
 * Miroir TypeScript de `backend/schemas.py`.
 * Si tu changes un type là-bas, change-le ici aussi.
 */

/** Où se trouve la balle sur une image donnée. */
export type BallDetection = {
  frame: number
  /** temps en secondes depuis le début */
  t: number
  x: number
  y: number
  /** entre 0 et 1 */
  conf: number
  /** true si la position est devinée, pas détectée */
  interpolated: boolean
}

/** Une ligne du court, repérée par ses extrémités. */
export type CourtLine = {
  name: string
  points: [number, number][]
}

/** Un moment repéré dans le point. */
export type Event = {
  type: 'hit' | 'bounce' | 'point_end'
  frame: number
  t: number
  x?: number
  y?: number
  conf: number
}

/** Le résultat complet de l'analyse d'une vidéo (onglet Replay, plus tard). */
export type Timeline = {
  video: string
  fps: number
  duration_s: number
  ball_track: BallDetection[]
  court_lines: CourtLine[]
  events: Event[]
}

/** Une image envoyée au serveur. */
export type DetectRequest = {
  frame_id: number
  /** JPEG encodé en base64 */
  image: string
  width: number
  height: number
  /** performance.now() au moment de l'envoi */
  sent_at: number
}

/** La réponse du serveur pour une image. */
export type DetectResponse = {
  frame_id: number
  /** null = balle pas vue sur cette image */
  detection: BallDetection | null
  inference_ms: number
  sent_at: number
}

export type SocketStatus = 'connecting' | 'open' | 'closed'

/** Ce qu'on affiche dans le panneau de performances de l'onglet Camera. */
export type Metrics = {
  /** images par seconde capturées depuis la caméra et envoyées */
  capturedFps: number
  /** images par seconde pour lesquelles une réponse est revenue */
  processedFps: number
  /** aller-retour complet front -> serveur -> front, en ms */
  roundTripMs: number
  /** temps passé côté serveur dans la détection, en ms */
  inferenceMs: number
  /** confiance de la dernière détection, null si la balle n'a pas été vue */
  lastConf: number | null
  /** nombre d'images où la balle n'a pas été vue */
  missedFrames: number
  /** nombre total d'images traitées */
  totalFrames: number
}

export const EMPTY_METRICS: Metrics = {
  capturedFps: 0,
  processedFps: 0,
  roundTripMs: 0,
  inferenceMs: 0,
  lastConf: null,
  missedFrames: 0,
  totalFrames: 0,
}
