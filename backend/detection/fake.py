"""
The fake detector of milestone 1.

It loads no model and does not even look at the image: it makes up a ball
position from the frame number. The goal is not to detect anything, it is to
check that the whole chain works (camera -> server -> drawing) and to measure
what the round trip costs.

This is the ONLY file to replace in milestone 2, when a real YOLO goes in.
"""

import math
import random

from schemas import BallDetection

# One frame in ten with no ball: this forces the frontend to handle gaps from
# the start, since gaps are the real tracking problem (interpolation, Kalman).
MISS_RATE = 0.1

# Assumed frame rate, only used to compute `t`.
ASSUMED_FPS = 15.0


def detect(width: int, height: int, frame_id: int) -> BallDetection | None:
    """Make up a ball position for frame `frame_id`.

    The ball follows a Lissajous curve: two sines with different periods on x
    and y. That gives a motion which does not repeat immediately, which is more
    interesting to draw than a plain circle.
    """
    if random.random() < MISS_RATE:
        return None

    # Keep a 10% margin on each edge so the ball stays visible.
    margin_x = width * 0.1
    margin_y = height * 0.1
    amplitude_x = (width - 2 * margin_x) / 2
    amplitude_y = (height - 2 * margin_y) / 2

    # Phase advances with the frame number.
    phase = frame_id * 0.08

    x = margin_x + amplitude_x * (1 + math.sin(phase * 3))
    y = margin_y + amplitude_y * (1 + math.sin(phase * 2))

    return BallDetection(
        frame=frame_id,
        t=frame_id / ASSUMED_FPS,
        x=round(x, 1),
        y=round(y, 1),
        conf=round(random.uniform(0.55, 0.95), 2),
        interpolated=False,
    )
