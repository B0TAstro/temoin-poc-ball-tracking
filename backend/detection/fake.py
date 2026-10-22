"""
The fake detector of milestone 1.

It loads no model and does not look at the image: it makes up a ball position
from the frame number. Kept after milestone 2 on purpose, as the latency
baseline — run the app with DETECTOR=fake to measure the chain without a model.
"""

import math
import random

import numpy as np

from detection import ASSUMED_FPS
from schemas import BallDetection

# One frame in ten with no ball: this forces the frontend to handle gaps, since
# gaps are the real tracking problem (interpolation, Kalman).
MISS_RATE = 0.1


class FakeDetector:
    name = "fake"

    def detect(self, image: np.ndarray, frame_id: int) -> list[BallDetection]:
        """Make up a ball position for frame `frame_id`.

        The ball follows a Lissajous curve: two sines with different periods on
        x and y. That gives a motion which does not repeat immediately, which is
        more interesting to draw than a plain circle.
        """
        if random.random() < MISS_RATE:
            return []

        height, width = image.shape[:2]

        # Keep a 10% margin on each edge so the ball stays visible.
        margin_x = width * 0.1
        margin_y = height * 0.1
        amplitude_x = (width - 2 * margin_x) / 2
        amplitude_y = (height - 2 * margin_y) / 2

        # Phase advances with the frame number.
        phase = frame_id * 0.08

        return [
            BallDetection(
                frame=frame_id,
                t=frame_id / ASSUMED_FPS,
                x=round(margin_x + amplitude_x * (1 + math.sin(phase * 3)), 1),
                y=round(margin_y + amplitude_y * (1 + math.sin(phase * 2)), 1),
                conf=round(random.uniform(0.55, 0.95), 2),
                interpolated=False,
            )
        ]
