/**
 * Dessin de la balle et de sa trajectoire dans le canvas superposé à la vidéo.
 *
 * Le canvas a exactement les mêmes dimensions que l'image envoyée au serveur,
 * donc les coordonnées reçues s'utilisent telles quelles, sans conversion.
 */

import type { BallDetection } from './types'

/** Une position de la trajectoire. `null` = image où la balle n'a pas été vue. */
export type TrailPoint = BallDetection | null

/** Combien de positions passées on garde pour dessiner la trajectoire. */
export const TRAIL_LENGTH = 30

const BALL_COLOR = '#d9f99d' // vert-jaune, comme une balle de tennis
const TRAIL_COLOR = '217, 249, 157'

/** Efface tout le canvas. */
export function clear(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
}

/**
 * Dessine la trajectoire puis la balle courante.
 *
 * La trajectoire est une suite de segments : chaque `null` coupe le trait,
 * pour qu'on voie à l'œil les images où la détection a échoué.
 */
export function drawTrack(ctx: CanvasRenderingContext2D, trail: TrailPoint[]) {
  clear(ctx)

  // --- La trajectoire, du plus ancien au plus récent ---
  for (let i = 1; i < trail.length; i++) {
    const from = trail[i - 1]
    const to = trail[i]
    // Un trou d'un côté ou de l'autre : pas de segment, le trait se coupe.
    if (!from || !to) continue

    // Plus le segment est récent, plus il est opaque et épais.
    const age = i / trail.length
    ctx.strokeStyle = `rgba(${TRAIL_COLOR}, ${0.15 + age * 0.65})`
    ctx.lineWidth = 1 + age * 2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
  }

  // --- La balle courante ---
  const current = trail[trail.length - 1]
  if (!current) return

  ctx.beginPath()
  ctx.arc(current.x, current.y, 7, 0, Math.PI * 2)
  ctx.fillStyle = BALL_COLOR
  ctx.fill()

  // Un cercle autour, dont l'opacité suit la confiance de la détection.
  ctx.beginPath()
  ctx.arc(current.x, current.y, 13, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(${TRAIL_COLOR}, ${current.conf})`
  ctx.lineWidth = 2
  ctx.stroke()

  // La confiance en chiffres, juste à côté.
  ctx.font = '12px monospace'
  ctx.fillStyle = BALL_COLOR
  ctx.fillText(current.conf.toFixed(2), current.x + 18, current.y + 4)
}
