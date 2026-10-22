"""Turning what the browser sends into something a detector can read."""

import base64

import cv2
import numpy as np


def decode_jpeg(data_url: str) -> np.ndarray | None:
    """Decode a base64 data URL into a BGR image.

    The frontend sends `data:image/jpeg;base64,<payload>`. Returns None when
    the payload is not a readable image, so a corrupt frame is skipped instead
    of killing the connection.
    """
    _, _, payload = data_url.partition(",")
    if not payload:
        return None

    raw = base64.b64decode(payload)
    buffer = np.frombuffer(raw, dtype=np.uint8)
    # imdecode returns None when the bytes are not a valid image.
    return cv2.imdecode(buffer, cv2.IMREAD_COLOR)
