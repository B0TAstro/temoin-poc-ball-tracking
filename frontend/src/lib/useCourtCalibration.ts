/**
 * Clicking the four court corners, and what follows from them.
 *
 * Automatic court detection is the goal, but it is not what this does: a human
 * clicks four corners and the homography follows. In the real app the phone
 * sits still for a whole match, so calibrating once at setup is an acceptable
 * step — and the player then *sees* the court model land on the real lines
 * instead of trusting a black box, which is the whole spirit of Témoin.
 *
 * The corners are remembered per video in the browser, so reloading does not
 * mean clicking again.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { fetchLineCalls } from './api'
import type {
  BallDetection,
  CourtLine,
  Event,
  ImagePoint,
  LineCall,
} from './types'

/** In the order the interface asks for them. */
export const CORNER_LABELS = [
  'coin proche gauche',
  'coin proche droite',
  'coin loin droite',
  'coin loin gauche',
] as const

function storageKey(video: string) {
  return `temoin.court.${video}`
}

/** Reading browser storage can throw, and can come back empty. Never trust it. */
function loadCorners(video: string): ImagePoint[] {
  try {
    const raw = localStorage.getItem(storageKey(video))
    const parsed = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) && parsed.length === 4 ? parsed : []
  } catch {
    return []
  }
}

function saveCorners(video: string, corners: ImagePoint[]) {
  try {
    if (corners.length === 4) {
      localStorage.setItem(storageKey(video), JSON.stringify(corners))
    } else {
      localStorage.removeItem(storageKey(video))
    }
  } catch {
    // Private window, blocked storage: the calibration just will not persist.
  }
}

type Options = {
  video: string | null
  fps: number
  track: BallDetection[]
  events: Event[]
}

export function useCourtCalibration({ video, fps, track, events }: Options) {
  // Corners travel with the video they belong to, so that switching video can
  // adjust them during the render rather than in an effect: React's own
  // "adjusting state when a prop changes" pattern. Doing it in an effect would
  // show one frame of the previous video's calibration first.
  const [state, setState] = useState<{ video: string | null; corners: ImagePoint[] }>(
    () => ({ video, corners: video ? loadCorners(video) : [] }),
  )
  const [calibrating, setCalibrating] = useState(false)
  const [courtLines, setCourtLines] = useState<CourtLine[]>([])
  const [calls, setCalls] = useState<LineCall[]>([])
  const [singles, setSingles] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Which request is current: an older answer must not overwrite a newer one.
  const requestRef = useRef(0)

  if (state.video !== video) {
    setState({ video, corners: video ? loadCorners(video) : [] })
    setCalibrating(false)
    setCourtLines([])
    setCalls([])
    setError(null)
  }

  const corners = state.corners
  const setCorners = useCallback(
    (update: (current: ImagePoint[]) => ImagePoint[]) =>
      setState((current) => ({ ...current, corners: update(current.corners) })),
    [],
  )

  const addCorner = useCallback(
    (point: ImagePoint) => {
      setCorners((current) => {
        if (current.length >= 4) return current
        const next = [...current, point]
        if (next.length === 4) {
          setCalibrating(false)
          if (video) saveCorners(video, next)
        }
        return next
      })
    },
    [video, setCorners],
  )

  const reset = useCallback(() => {
    setCorners(() => [])
    setCourtLines([])
    setCalls([])
    setError(null)
    if (video) saveCorners(video, [])
  }, [video, setCorners])

  const start = useCallback(() => {
    reset()
    setCalibrating(true)
  }, [reset])

  // Ask the server as soon as four corners exist, and again when anything the
  // answer depends on changes. The state below is set from the promise, after
  // the effect has returned, not during it.
  useEffect(() => {
    if (corners.length !== 4) return

    const ticket = ++requestRef.current
    // oxlint-disable-next-line react/set-state-in-effect
    setError(null)

    fetchLineCalls({
      corners: corners.map((corner) => [corner.x, corner.y] as [number, number]),
      singles,
      fps,
      track,
      events,
    })
      .then((answer) => {
        if (ticket !== requestRef.current) return // a newer request won
        setCourtLines(answer.court_lines)
        setCalls(answer.calls)
      })
      .catch((caught: unknown) => {
        if (ticket !== requestRef.current) return
        setCourtLines([])
        setCalls([])
        setError(caught instanceof Error ? caught.message : String(caught))
      })
  }, [corners, singles, fps, track, events])

  return {
    corners,
    calibrating,
    courtLines,
    calls,
    singles,
    error,
    setSingles,
    start,
    reset,
    addCorner,
  }
}
