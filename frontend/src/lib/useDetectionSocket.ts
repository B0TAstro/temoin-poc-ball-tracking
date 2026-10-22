/**
 * Connexion WebSocket au serveur de détection.
 *
 * Règle importante : on n'envoie pas l'image suivante tant que la précédente
 * n'est pas revenue. Sinon on accumule du retard et la latence mesurée ne veut
 * plus rien dire.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import type { DetectRequest, DetectResponse, SocketStatus } from './types'

const WS_URL = 'ws://localhost:8000/ws/detect'
const RECONNECT_DELAY_MS = 2000

type Options = {
  /** Appelé à chaque réponse du serveur. */
  onDetection: (response: DetectResponse, roundTripMs: number) => void
}

export function useDetectionSocket({ onDetection }: Options) {
  const [status, setStatus] = useState<SocketStatus>('connecting')
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<number | null>(null)
  // true dès qu'une image est partie, false quand sa réponse est revenue.
  const waitingRef = useRef(false)
  // On garde le callback dans une ref pour ne pas reconnecter à chaque rendu.
  // L'écriture se fait dans un effet : toucher une ref pendant le rendu est
  // déconseillé, et l'effet passe bien avant la première réponse du serveur.
  const onDetectionRef = useRef(onDetection)
  useEffect(() => {
    onDetectionRef.current = onDetection
  }, [onDetection])

  useEffect(() => {
    let closedByUs = false

    const connect = () => {
      setStatus('connecting')
      const socket = new WebSocket(WS_URL)
      socketRef.current = socket

      socket.onopen = () => setStatus('open')

      socket.onmessage = (event) => {
        const response: DetectResponse = JSON.parse(event.data)
        // L'aller-retour complet : le serveur nous a renvoyé notre horodatage.
        const roundTripMs = performance.now() - response.sent_at
        waitingRef.current = false
        onDetectionRef.current(response, roundTripMs)
      }

      socket.onclose = () => {
        setStatus('closed')
        waitingRef.current = false
        // Le serveur est tombé : on retente, sans faire planter la caméra.
        if (!closedByUs) {
          reconnectRef.current = window.setTimeout(connect, RECONNECT_DELAY_MS)
        }
      }

      // onerror est toujours suivi de onclose : rien à faire de plus ici.
      socket.onerror = () => socket.close()
    }

    connect()

    return () => {
      closedByUs = true
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current)
      socketRef.current?.close()
    }
  }, [])

  /** Envoie une image, sauf si on attend encore la réponse de la précédente. */
  const send = useCallback((request: Omit<DetectRequest, 'sent_at'>) => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return false
    if (waitingRef.current) return false

    waitingRef.current = true
    socket.send(JSON.stringify({ ...request, sent_at: performance.now() }))
    return true
  }, [])

  return { status, send }
}
