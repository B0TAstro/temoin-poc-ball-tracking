"""Ball detection and tracking.

Two detectors live here and they are interchangeable:

- `fake`     — makes up a position, loads no model (milestone 1). Kept on
               purpose: it is the latency baseline to compare against.
- `yolo11n`  — a real pre-trained YOLO, "sports ball" class (milestone 2).

Pick one with the DETECTOR environment variable, e.g. `DETECTOR=fake`.
"""

from typing import Protocol

import numpy as np

from schemas import BallDetection

#: Frame rate we assume to turn a frame number into a timestamp. The live tab
#: has no real frame rate, so this is only indicative.
ASSUMED_FPS = 15.0

#: Default detector when DETECTOR is not set.
DEFAULT_DETECTOR = "yolo11n"


class Detector(Protocol):
    """What the server needs from a detector, and nothing more."""

    #: Shown in the UI so you always know which detector produced a figure.
    name: str

    def detect(self, image: np.ndarray, frame_id: int) -> list[BallDetection]:
        """Every ball candidate on one BGR frame, most confident first.

        Returning a list rather than the single best box matters more than it
        looks. On a broadcast clip, a yellow advertising panel at the edge of
        the court was detected as a "sports ball" on 100% of frames, and it
        outscored the real ball on 69% of them. Keeping only the best box meant
        tracking the panel and throwing the ball away. Sorting out which
        candidate is the ball is `tracking.py`'s job, and it needs them all.
        """
        ...


def load_detector(name: str, imgsz: int | None = None) -> Detector:
    """Build a detector by name. Imports lazily so `fake` needs no PyTorch.

    `imgsz` only means something to a real model: it is the size the frame is
    scaled to before going through the network. The live tab keeps it small to
    stay fast, the replay tab can afford more.
    """
    if name == "fake":
        from detection.fake import FakeDetector

        return FakeDetector()

    if name.startswith("yolo"):
        from detection.yolo import DEFAULT_IMGSZ, YoloDetector

        return YoloDetector(weights=f"{name}.pt", imgsz=imgsz or DEFAULT_IMGSZ)

    raise ValueError(f"unknown detector {name!r} (try 'fake' or 'yolo11n')")
