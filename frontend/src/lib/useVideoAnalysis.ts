/**
 * Asking the server to analyse a whole video, and following along.
 *
 * Unlike the camera socket, this one is opened for one job and closed when it
 * is done. The server streams progress while it walks the file, then sends the
 * finished timeline.
 */

import { useCallback, useRef, useState } from 'react'

import { WS_BASE } from './api'
import type { AnalyzeDone, AnalyzeMessage, AnalyzeRequest } from './types'

export type AnalysisState =
  | { phase: 'idle' }
  | { phase: 'running'; frame: number; total: number }
  | { phase: 'done'; result: AnalyzeDone }
  | { phase: 'error'; message: string }

export function useVideoAnalysis() {
  const [state, setState] = useState<AnalysisState>({ phase: 'idle' })
  const socketRef = useRef<WebSocket | null>(null)

  const cancel = useCallback(() => {
    socketRef.current?.close()
    socketRef.current = null
    setState({ phase: 'idle' })
  }, [])

  const analyze = useCallback((request: AnalyzeRequest) => {
    // A previous run still going: drop it, the new request wins.
    socketRef.current?.close()

    setState({ phase: 'running', frame: 0, total: 0 })
    const socket = new WebSocket(`${WS_BASE}/ws/analyze`)
    socketRef.current = socket

    socket.onopen = () => socket.send(JSON.stringify(request))

    socket.onmessage = (event) => {
      const message: AnalyzeMessage = JSON.parse(event.data)
      if (message.kind === 'progress') {
        setState({ phase: 'running', frame: message.frame, total: message.total })
      } else if (message.kind === 'done') {
        setState({ phase: 'done', result: message })
        socket.close()
      } else {
        setState({ phase: 'error', message: message.message })
        socket.close()
      }
    }

    socket.onerror = () =>
      setState({
        phase: 'error',
        message: "le serveur ne répond pas — il tourne bien sur le port 8000 ?",
      })
  }, [])

  return { state, analyze, cancel }
}
