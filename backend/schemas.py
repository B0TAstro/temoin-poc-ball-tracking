"""
The data contract, typed once and for all.

Mirrors the timeline format described in CLAUDE.md. The frontend keeps a mirror
of these types in `frontend/src/lib/types.ts`: change one, change the other.

Coordinates are in pixels of the source frame, `conf` is between 0 and 1.
"""

from typing import Literal

from pydantic import BaseModel, Field


# --- Timeline format (used later by the Replay tab) ---


class BallDetection(BaseModel):
    """Where the ball is on a given frame."""

    frame: int
    t: float  # seconds since the start
    x: float
    y: float
    conf: float = Field(ge=0.0, le=1.0)
    interpolated: bool = False  # True when the position is guessed, not detected


class CourtLine(BaseModel):
    """A court line, described by its endpoints (for now)."""

    name: str  # e.g. "baseline_far"
    points: list[tuple[float, float]]


class Event(BaseModel):
    """A moment spotted in the point: a hit, a bounce, the end of the point."""

    type: Literal["hit", "bounce", "point_end"]
    frame: int
    t: float
    x: float | None = None
    y: float | None = None
    conf: float = Field(ge=0.0, le=1.0)


class Timeline(BaseModel):
    """The full result of analysing one video."""

    video: str
    fps: float
    duration_s: float
    ball_track: list[BallDetection] = []
    court_lines: list[CourtLine] = []
    events: list[Event] = []


# --- Live messages (Camera tab, over WebSocket) ---


class DetectRequest(BaseModel):
    """One camera frame sent to the server."""

    frame_id: int
    image: str  # JPEG encoded as base64 (data URL)
    width: int
    height: int
    sent_at: float  # frontend timestamp in ms (performance.now())


class DetectResponse(BaseModel):
    """The server's answer for one frame."""

    frame_id: int
    detection: BallDetection | None  # None = ball not seen on this frame
    detector: str  # which detector produced it ("fake", "yolo11n", ...)
    decode_ms: float  # time spent turning the JPEG back into pixels
    inference_ms: float  # time spent in the model itself
    sent_at: float  # echoed back so the frontend can compute the round trip


# --- Replay tab: analysing a video file ---


class VideoInfo(BaseModel):
    """One video available in `data/videos/`."""

    name: str
    size_bytes: int
    fps: float
    frames: int
    width: int
    height: int
    duration_s: float


class AnalyzeRequest(BaseModel):
    """Analyse one video, start to finish."""

    video: str
    #: None keeps whichever detector the server booted with.
    detector: str | None = None
    #: The size the model works at. 640 is the live default; the replay tab is
    #: not in a hurry and a tennis ball is small, so it asks for more.
    imgsz: int = 1280


class AnalyzeProgress(BaseModel):
    """Sent while the analysis runs, every few frames."""

    kind: Literal["progress"] = "progress"
    frame: int
    total: int  # 0 when the file does not say how long it is
    detection: BallDetection | None


class RejectedObject(BaseModel):
    """Something the tracking dropped because it never moved."""

    x: float
    y: float
    frames: int


class AnalyzeDone(BaseModel):
    """Sent once, at the end, with the whole timeline."""

    kind: Literal["done"] = "done"
    timeline: Timeline
    frames_read: int
    #: Frames where the detector proposed at least one candidate. Includes the
    #: static objects, so this is always the most flattering number.
    frames_with_candidate: int
    #: Frames the tracking kept as really being the ball. The honest one.
    frames_with_ball: int
    #: Positions filled in between two detections, guessed not measured.
    frames_interpolated: int
    #: How many separate runs of the ball the point was made of.
    segments: int
    #: What was dropped for standing still — a panel, a logo, a bag.
    rejected_static: list[RejectedObject]
    elapsed_s: float
    detector: str
    imgsz: int


class AnalyzeError(BaseModel):
    """Sent instead of a result when the analysis could not run."""

    kind: Literal["error"] = "error"
    message: str


# --- Court calibration and line calls ---


class LineCallsRequest(BaseModel):
    """Read the bounces of a timeline on the court plane.

    The frontend sends back the timeline it already holds, so the server keeps
    no session state and recalibrating costs nothing: click four corners again
    and ask again, no re-analysis.
    """

    #: The four outer court corners in image pixels, in this order:
    #: near-left, near-right, far-right, far-left.
    corners: list[tuple[float, float]]
    #: Singles court by default; set false to judge against the tramlines.
    singles: bool = True
    fps: float
    track: list[BallDetection]
    events: list[Event]


class LineCallOut(BaseModel):
    """One bounce, read on the court."""

    frame: float  # fractional: the bounce falls between two frames
    t: float
    court_x: float  # metres across the court, 0 at the centre
    court_y: float  # metres along the court, 0 at the net
    margin_m: float  # positive inside, negative outside
    nearest_line: str
    verdict: Literal["in", "out", "too_close"]
    uncertainty_m: float
    refined: bool
    #: Where the refined bounce sits in the picture, for drawing it.
    image_x: float
    image_y: float


class LineCallsResponse(BaseModel):
    """What the calibration gives: the court drawn back, and the calls."""

    #: Every court line projected into the image, to check the calibration by
    #: eye. If these land on the painted lines, the corners were right.
    court_lines: list[CourtLine]
    calls: list[LineCallOut]
