"""
Server for the ball tracking POC.

Milestone 1: no model is loaded. It exposes a health endpoint and a WebSocket
that answers every camera frame with a fake detection. What we want to measure
here is the latency of the round trip.
"""

import time

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from detection import fake
from schemas import DetectRequest, DetectResponse

app = FastAPI(title="temoin-poc-ball-tracking", version="0.1.0")

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
    """Just enough to check that the server answers."""
    return {"status": "ok", "model": "fake"}


@app.websocket("/ws/detect")
async def ws_detect(websocket: WebSocket) -> None:
    """Receive camera frames, answer with one detection per frame.

    In milestone 1 the JPEG is NOT decoded: the latency measured here is the
    floor, the one of the network and of serialisation. Milestone 2 will show
    what decoding and inference add on top.
    """
    await websocket.accept()
    try:
        while True:
            payload = await websocket.receive_json()
            request = DetectRequest(**payload)

            # Time the detection only, not the network wait.
            start = time.perf_counter()
            detection = fake.detect(request.width, request.height, request.frame_id)
            inference_ms = (time.perf_counter() - start) * 1000

            response = DetectResponse(
                frame_id=request.frame_id,
                detection=detection,
                inference_ms=round(inference_ms, 3),
                sent_at=request.sent_at,
            )
            await websocket.send_json(response.model_dump())
    except WebSocketDisconnect:
        # The frontend closed the tab or stopped the camera: nothing to report.
        pass
