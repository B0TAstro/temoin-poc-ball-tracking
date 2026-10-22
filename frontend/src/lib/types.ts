/**
 * TypeScript mirror of `backend/schemas.py`.
 * Change a type there, change it here too.
 */

/** Where the ball is on a given frame. */
export type BallDetection = {
  frame: number
  /** seconds since the start */
  t: number
  x: number
  y: number
  /** between 0 and 1 */
  conf: number
  /** true when the position is guessed, not detected */
  interpolated: boolean
}

/** A court line, described by its endpoints. */
export type CourtLine = {
  name: string
  points: [number, number][]
}

/** A moment spotted in the point. */
export type Event = {
  type: 'hit' | 'bounce' | 'point_end'
  frame: number
  t: number
  x?: number
  y?: number
  conf: number
}

/** The full result of analysing one video (Replay tab, later on). */
export type Timeline = {
  video: string
  fps: number
  duration_s: number
  ball_track: BallDetection[]
  court_lines: CourtLine[]
  events: Event[]
}

/** One camera frame sent to the server. */
export type DetectRequest = {
  frame_id: number
  /** JPEG encoded as base64 */
  image: string
  width: number
  height: number
  /** performance.now() at send time */
  sent_at: number
}

/** The server's answer for one frame. */
export type DetectResponse = {
  frame_id: number
  /** null = ball not seen on this frame */
  detection: BallDetection | null
  /** which detector produced it ("fake", "yolo11n", ...) */
  detector: string
  /** time spent turning the JPEG back into pixels, in ms */
  decode_ms: number
  /** time spent in the model itself, in ms */
  inference_ms: number
  sent_at: number
}

export type SocketStatus = 'connecting' | 'open' | 'closed'

/** What the Camera tab shows in its performance panel. */
export type Metrics = {
  /** frames per second captured from the camera and sent */
  capturedFps: number
  /** frames per second for which an answer came back */
  processedFps: number
  /** full round trip frontend -> server -> frontend, in ms */
  roundTripMs: number
  /** server side: time spent decoding the JPEG, in ms */
  decodeMs: number
  /** server side: time spent in the model, in ms */
  inferenceMs: number
  /** name of the detector answering, as the server reports it */
  detector: string
  /** confidence of the last detection, null when the ball was not seen */
  lastConf: number | null
  /** how many frames had no ball */
  missedFrames: number
  /** how many frames were processed in total */
  totalFrames: number
}

export const EMPTY_METRICS: Metrics = {
  capturedFps: 0,
  processedFps: 0,
  roundTripMs: 0,
  decodeMs: 0,
  inferenceMs: 0,
  detector: '…',
  lastConf: null,
  missedFrames: 0,
  totalFrames: 0,
}

// --- Replay tab ---

/** One video available on the server, in `data/videos/`. */
export type VideoInfo = {
  name: string
  size_bytes: number
  fps: number
  frames: number
  width: number
  height: number
  duration_s: number
}

/** What we ask the server to analyse, and how. */
export type AnalyzeRequest = {
  video: string
  /** null keeps whichever detector the server booted with */
  detector: string | null
  /** the size the model works at — the setting that matters most here */
  imgsz: number
}

export type AnalyzeProgress = {
  kind: 'progress'
  frame: number
  /** 0 when the file does not say how long it is */
  total: number
  detection: BallDetection | null
}

/** Something the tracking dropped because it never moved. */
export type RejectedObject = {
  x: number
  y: number
  frames: number
}

export type AnalyzeDone = {
  kind: 'done'
  timeline: Timeline
  frames_read: number
  /** frames where the detector proposed anything — the flattering number */
  frames_with_candidate: number
  /** frames the tracking kept as really being the ball — the honest one */
  frames_with_ball: number
  /** positions filled between two detections, guessed not measured */
  frames_interpolated: number
  /** how many separate runs of the ball the point was made of */
  segments: number
  /** what was dropped for standing still */
  rejected_static: RejectedObject[]
  elapsed_s: number
  detector: string
  imgsz: number
}

export type AnalyzeError = {
  kind: 'error'
  message: string
}

export type AnalyzeMessage = AnalyzeProgress | AnalyzeDone | AnalyzeError
