"""
Server for the ball tracking POC.

Milestone 2: a real pre-trained YOLO answers every camera frame. The figures
are reported split in two — JPEG decoding and model inference — so they can be
compared with the milestone 1 baseline, where the server did neither.

Swap detectors without touching the frontend:

    DETECTOR=fake uvicorn main:app      # milestone 1 baseline, no model
    DETECTOR=yolo11n uvicorn main:app   # default
    DETECTOR=yolo11s uvicorn main:app   # bigger, slower, better on small objects
"""

import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

import frames
from detection import DEFAULT_DETECTOR, Detector, load_detector
from schemas import DetectRequest, DetectResponse

#: Filled at startup. Loading YOLO takes a second or two, and we would rather
#: pay it once at boot than on the first frame the camera sends.
detector: Detector


@asynccontextmanager
async def lifespan(app: FastAPI):
    global detector
    name = os.environ.get("DETECTOR", DEFAULT_DETECTOR)
    detector = load_detector(name)
    print(f"detector ready: {detector.name}")
    yield


app = FastAPI(title="temoin-poc-ball-tracking", version="0.2.0", lifespan=lifespan)

# The frontend runs on Vite's dev server, on a different origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    """Just enough to check that the server answers, and with which detector."""
    return {"status": "ok", "detector": detector.name}


@app.websocket("/ws/detect")
async def ws_detect(websocket: WebSocket) -> None:
    """Receive camera frames, answer with one detection per frame."""
    await websocket.accept()
    try:
        while True:
            payload = await websocket.receive_json()
            request = DetectRequest(**payload)

            start = time.perf_counter()
            image = frames.decode_jpeg(request.image)
            decode_ms = (time.perf_counter() - start) * 1000

            if image is None:
                # Unreadable frame. We still answer: the frontend waits for one
                # reply per frame before sending the next, so staying silent
                # would stall the whole stream.
                detection, inference_ms = None, 0.0
            else:
                start = time.perf_counter()
                detection = detector.detect(image, request.frame_id)
                inference_ms = (time.perf_counter() - start) * 1000

            response = DetectResponse(
                frame_id=request.frame_id,
                detection=detection,
                detector=detector.name,
                decode_ms=round(decode_ms, 3),
                inference_ms=round(inference_ms, 3),
                sent_at=request.sent_at,
            )
            await websocket.send_json(response.model_dump())
    except WebSocketDisconnect:
        # The frontend closed the tab or stopped the camera: nothing to report.
        pass
