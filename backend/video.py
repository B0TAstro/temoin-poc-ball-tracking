"""
Running a detector over a whole video file, frame by frame.

This is the Replay tab's engine. Unlike the live tab, nothing here is in a
hurry: we can afford a bigger analysis size, which matters a lot for an object
as small as a tennis ball.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

import cv2

import tracking
from detection import Detector
from events import find_events
from schemas import BallDetection, Timeline


@dataclass
class Progress:
    """Where we are, reported as the analysis goes.

    `detection` is only the most confident candidate of that frame, shown so
    something moves on screen while we wait. It is NOT what ends up in the
    timeline: which candidate is really the ball is decided afterwards, once
    the whole trajectory is known. See tracking.py.
    """

    frame: int
    total: int  # 0 when the file does not say how many frames it has
    detection: BallDetection | None


class VideoAnalysis:
    """Opens a video, runs a detector on every frame, builds a Timeline.

    Used as:

        analysis = VideoAnalysis(path, detector)
        for progress in analysis.run():
            ...            # report it
        timeline = analysis.timeline()
    """

    def __init__(self, path: Path, detector: Detector) -> None:
        self.path = path
        self.detector = detector

        capture = cv2.VideoCapture(str(path))
        if not capture.isOpened():
            raise ValueError(f"cannot open video {path.name}")
        self.capture = capture

        # Some files lie about this, or do not say at all. Fall back to 30,
        # which is what a phone shoots by default.
        self.fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
        self.frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        self.width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        self.height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)

        # Every candidate of every frame, not just the best one. Deciding
        # which is the ball needs the whole clip.
        self._per_frame: list[list[BallDetection]] = []
        self._frames_read = 0
        self._result: tracking.TrackingResult | None = None

    @property
    def duration_s(self) -> float:
        return self.frame_count / self.fps if self.frame_count else 0.0

    def run(self) -> Iterator[Progress]:
        """Walk the whole video, keeping every candidate of every frame."""
        frame_id = 0
        try:
            while True:
                ok, image = self.capture.read()
                if not ok:
                    break

                candidates = self.detector.detect(image, frame_id)
                for candidate in candidates:
                    # Overwrite the assumed timestamp with the real one.
                    candidate.t = round(frame_id / self.fps, 4)
                self._per_frame.append(candidates)

                self._frames_read = frame_id + 1
                yield Progress(
                    frame=frame_id,
                    total=self.frame_count,
                    detection=candidates[0] if candidates else None,
                )
                frame_id += 1
        finally:
            self.capture.release()

    def result(self) -> tracking.TrackingResult:
        """Run the tracking, once, and keep the answer."""
        if self._result is None:
            self._result = tracking.build_track(
                self._per_frame,
                frame_width=self.width,
                fps=self.fps,
                total_frames=self._frames_read or self.frame_count,
            )
        return self._result

    @property
    def per_frame(self) -> list[list[BallDetection]]:
        """Raw candidates, kept for offline study."""
        return self._per_frame

    def timeline(self) -> Timeline:
        """The result, in the format described in CLAUDE.md."""
        # Trust what we actually read over what the file claimed.
        frames = self._frames_read or self.frame_count
        return Timeline(
            video=self.path.name,
            fps=round(self.fps, 3),
            duration_s=round(frames / self.fps, 3) if self.fps else 0.0,
            ball_track=self.result().track,
            court_lines=[],  # milestone 5
            events=find_events(self.result().track, self.fps),
        )

    @property
    def frames_read(self) -> int:
        return self._frames_read

    @property
    def frames_with_ball(self) -> int:
        """Frames the tracking actually kept, interpolation excluded."""
        return self.result().frames_detected
