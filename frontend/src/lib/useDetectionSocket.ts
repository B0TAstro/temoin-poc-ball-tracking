/**
 * WebSocket connection to the detection server.
 *
 * Important rule: we do not send the next frame until the previous one has
 * come back. Otherwise we pile up lag and the measured latency stops meaning
 * anything.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import type { DetectRequest, DetectResponse, SocketStatus } from './types'

const WS_URL = 'ws://localhost:8000/ws/detect'
const RECONNECT_DELAY_MS = 2000

type Options = {
  /** Called on every answer from the server. */
  onDetection: (response: DetectResponse, roundTripMs: number) => void
}

export function useDetectionSocket({ onDetection }: Options) {
  const [status, setStatus] = useState<SocketStatus>('connecting')
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<number | null>(null)
  // true as soon as a frame is out, false when its answer is back.
  const waitingRef = useRef(false)
  // The callback lives in a ref so we do not reconnect on every render.
  // Writing it happens in an effect: touching a ref during render is
  // discouraged, and the effect runs well before the first server answer.
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
        // The full round trip: the server echoed our own timestamp back.
        const roundTripMs = performance.now() - response.sent_at
        waitingRef.current = false
        onDetectionRef.current(response, roundTripMs)
      }

      socket.onclose = () => {
        setStatus('closed')
        waitingRef.current = false
        // The server went down: retry, without breaking the camera.
        if (!closedByUs) {
          reconnectRef.current = window.setTimeout(connect, RECONNECT_DELAY_MS)
        }
      }

      // onerror is always followed by onclose: nothing more to do here.
      socket.onerror = () => socket.close()
    }

    connect()

    return () => {
      closedByUs = true
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current)
      socketRef.current?.close()
    }
  }, [])

  /** Send a frame, unless we are still waiting for the previous answer. */
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
