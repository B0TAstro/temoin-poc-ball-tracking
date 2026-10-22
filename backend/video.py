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

from detection import Detector
from schemas import BallDetection, Timeline


@dataclass
class Progress:
    """Where we are, reported as the analysis goes."""

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

        self._track: list[BallDetection] = []
        self._frames_read = 0

    @property
    def duration_s(self) -> float:
        return self.frame_count / self.fps if self.frame_count else 0.0

    def run(self) -> Iterator[Progress]:
        """Walk the whole video, yielding once per frame.

        Only the frames where the ball was found end up in the track. The gaps
        are the missing frame numbers, and they are the interesting part: they
        are what interpolation and tracking will have to fill in later.
        """
        frame_id = 0
        try:
            while True:
                ok, image = self.capture.read()
                if not ok:
                    break

                detection = self.detector.detect(image, frame_id)
                if detection is not None:
                    # Overwrite the assumed timestamp with the real one.
                    detection.t = round(frame_id / self.fps, 4)
                    self._track.append(detection)

                self._frames_read = frame_id + 1
                yield Progress(
                    frame=frame_id,
                    total=self.frame_count,
                    detection=detection,
                )
                frame_id += 1
        finally:
            self.capture.release()

    def timeline(self) -> Timeline:
        """The result, in the format described in CLAUDE.md."""
        # Trust what we actually read over what the file claimed.
        frames = self._frames_read or self.frame_count
        return Timeline(
            video=self.path.name,
            fps=round(self.fps, 3),
            duration_s=round(frames / self.fps, 3) if self.fps else 0.0,
            ball_track=self._track,
            court_lines=[],  # milestone 5
            events=[],  # milestone 4: hits, bounces, end of point
        )

    @property
    def frames_read(self) -> int:
        return self._frames_read

    @property
    def frames_with_ball(self) -> int:
        return len(self._track)
