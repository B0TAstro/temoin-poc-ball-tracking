"""
A real pre-trained YOLO, with no fine-tuning at all (milestone 2).

The question this answers: what does an off-the-shelf YOLO see of a tennis
ball? YOLO is trained on COCO, which already has a "sports ball" class
(index 32) covering footballs, basketballs, tennis balls and the rest. If that
class works well enough, we skip the whole annotation effort. If it does not,
how it fails tells us how much data we will need.

Weights are downloaded once into `models/` (git-ignored) on first use.
"""

import os
from pathlib import Path

import numpy as np
import torch
from ultralytics import YOLO

from detection import ASSUMED_FPS
from schemas import BallDetection

#: COCO class index for "sports ball".
SPORTS_BALL_CLASS = 32

#: Below this score a box is dropped. Deliberately low: we would rather see the
#: weak detections and judge them than have the model hide them from us.
DEFAULT_CONF = 0.25

#: The size YOLO works at internally. The frame is letterboxed to a square of
#: this side before going through the network, so this is what really decides
#: how many pixels a far-away ball gets. Probably the single setting that
#: matters most for a tennis ball; 640 is the Ultralytics default.
DEFAULT_IMGSZ = 640

#: Where weights live. `models/` is git-ignored, see CLAUDE.md.
WEIGHTS_DIR = Path(__file__).resolve().parents[2] / "models"


def pick_device() -> str:
    """Choose where the model runs, fastest first.

    This matters a lot and Ultralytics does not get it right on its own: on an
    Apple M2, yolo11n takes about 200 ms per frame on the CPU and about 13 ms
    on the GPU through MPS. Left to itself Ultralytics picked the CPU, which
    put us 3x over the per-frame budget for no reason.

    Override with DEVICE=cpu to compare for yourself.
    """
    if torch.backends.mps.is_available():  # Apple Silicon GPU
        return "mps"
    if torch.cuda.is_available():  # NVIDIA, if this ever runs elsewhere
        return "cuda"
    return "cpu"


class YoloDetector:
    def __init__(
        self,
        weights: str = "yolo11n.pt",
        conf: float = DEFAULT_CONF,
        imgsz: int = DEFAULT_IMGSZ,
        device: str | None = None,
    ) -> None:
        self.name = Path(weights).stem
        self.conf = conf
        self.imgsz = imgsz
        self.device = device or os.environ.get("DEVICE") or pick_device()

        WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
        # Passing a full path means Ultralytics downloads straight into models/
        # instead of dropping the file next to the server code.
        self.model = YOLO(str(WEIGHTS_DIR / weights))

    def detect(self, image: np.ndarray, frame_id: int) -> list[BallDetection]:
        """Every sports-ball box on one BGR frame, most confident first."""
        results = self.model.predict(
            image,
            classes=[SPORTS_BALL_CLASS],  # ignore the 79 other COCO classes
            conf=self.conf,
            imgsz=self.imgsz,
            verbose=False,
            device=self.device,
        )

        boxes = results[0].boxes
        if boxes is None or len(boxes) == 0:
            return []

        candidates = []
        for i in range(len(boxes)):
            x1, y1, x2, y2 = (float(v) for v in boxes.xyxy[i])
            candidates.append(
                BallDetection(
                    frame=frame_id,
                    t=frame_id / ASSUMED_FPS,
                    # The ball position is the centre of the box.
                    x=round((x1 + x2) / 2, 1),
                    y=round((y1 + y2) / 2, 1),
                    conf=round(float(boxes.conf[i]), 3),
                    interpolated=False,
                )
            )

        candidates.sort(key=lambda candidate: candidate.conf, reverse=True)
        return candidates
