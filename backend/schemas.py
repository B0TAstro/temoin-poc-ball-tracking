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
    inference_ms: float  # time spent in detection, server side
    sent_at: float  # echoed back so the frontend can compute the round trip
