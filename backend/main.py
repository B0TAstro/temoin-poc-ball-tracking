"""
Server for the ball tracking POC.

Two jobs, one per live tab of the frontend:

- Camera: a WebSocket answering one detection per camera frame, as fast as it
  can. Small analysis size, because it has a 66 ms budget per frame.
- Replay: a WebSocket that walks a whole video file and streams back the
  timeline described in CLAUDE.md. No hurry, so it can afford a much bigger
  analysis size — which turns out to matter enormously for a tennis ball.

Environment variables:

    DETECTOR=fake|yolo11n|yolo11s|yolo11m   which model answers the camera
    DEVICE=cpu|mps|cuda                     where it runs (auto by default)
"""

import asyncio
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import frames
import videos_dir
from detection import DEFAULT_DETECTOR, Detector, load_detector
from schemas import (
    AnalyzeDone,
    AnalyzeError,
    AnalyzeProgress,
    AnalyzeRequest,
    DetectRequest,
    DetectResponse,
    VideoInfo,
)
from video import VideoAnalysis

#: The detector answering the camera. Loading YOLO takes a second or two, and
#: we would rather pay it at boot than on the first frame.
live_detector: Detector

#: Detectors built for the Replay tab, kept by (name, imgsz) so switching
#: settings back and forth does not reload the weights every time.
_analysis_detectors: dict[tuple[str, int], Detector] = {}

#: How often to tell the browser where the analysis is, in frames. Every frame
#: would flood the socket for no benefit.
PROGRESS_EVERY = 5


@asynccontextmanager
async def lifespan(app: FastAPI):
    global live_detector
    live_detector = load_detector(os.environ.get("DETECTOR", DEFAULT_DETECTOR))
    print(f"camera detector ready: {live_detector.name}")
    yield


app = FastAPI(title="temoin-poc-ball-tracking", version="0.3.0", lifespan=lifespan)

# The frontend runs on Vite's dev server, on a different origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve the test videos so the browser can play them. StaticFiles answers Range
# requests, which is what lets the player seek without downloading everything.
videos_dir.VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/videos", StaticFiles(directory=videos_dir.VIDEOS_DIR), name="videos")


@app.get("/health")
def health() -> dict[str, str]:
    """Just enough to check that the server answers, and with which detector."""
    return {"status": "ok", "detector": live_detector.name}


# --- Replay tab -------------------------------------------------------------


@app.get("/api/videos")
def list_videos() -> list[VideoInfo]:
    """What is available in `data/videos/`, preloaded or dropped earlier."""
    return videos_dir.listing()


@app.post("/api/videos")
async def upload_video(file: UploadFile) -> VideoInfo:
    """Take a dropped video and keep it alongside the preloaded ones.

    The file has to reach the server: OpenCV decodes it there, frame by frame.
    """
    name = Path(file.filename or "").name
    if Path(name).suffix.lower() not in videos_dir.ALLOWED_SUFFIXES:
        raise HTTPException(
            status_code=415,
            detail=f"unsupported file type: {name!r}",
        )

    target = videos_dir.VIDEOS_DIR / name
    with target.open("wb") as out:
        # Copy in chunks: these files run to tens of megabytes.
        while chunk := await file.read(1 << 20):
            out.write(chunk)

    try:
        return videos_dir.describe(target)
    except Exception:
        # Not something OpenCV can read after all: do not keep it around.
        target.unlink(missing_ok=True)
        raise HTTPException(status_code=415, detail=f"cannot read {name!r} as video")


def analysis_detector(name: str, imgsz: int) -> Detector:
    """Get (and remember) a detector set up for offline analysis."""
    key = (name, imgsz)
    if key not in _analysis_detectors:
        _analysis_detectors[key] = load_detector(name, imgsz=imgsz)
    return _analysis_detectors[key]


@app.websocket("/ws/analyze")
async def ws_analyze(websocket: WebSocket) -> None:
    """Walk a whole video, streaming progress, then send the timeline.

    The work is blocking (OpenCV then the model), but every `await` below hands
    control back to the event loop, so progress really does flow while it runs.
    """
    await websocket.accept()
    try:
        while True:
            request = AnalyzeRequest(**await websocket.receive_json())

            try:
                path = videos_dir.resolve(request.video)
                detector = analysis_detector(
                    request.detector or live_detector.name, request.imgsz
                )
                analysis = VideoAnalysis(path, detector)
            except (ValueError, FileNotFoundError) as caught:
                await websocket.send_json(AnalyzeError(message=str(caught)).model_dump())
                continue

            start = time.perf_counter()
            for progress in analysis.run():
                # Report on the first frame, then every few, then let the final
                # message carry the rest.
                if progress.frame % PROGRESS_EVERY == 0:
                    await websocket.send_json(
                        AnalyzeProgress(
                            frame=progress.frame,
                            total=progress.total,
                            detection=progress.detection,
                        ).model_dump()
                    )
                else:
                    # Still give the loop a chance to breathe, so a client that
                    # disconnects mid-analysis is noticed.
                    await asyncio.sleep(0)

            await websocket.send_json(
                AnalyzeDone(
                    timeline=analysis.timeline(),
                    frames_read=analysis.frames_read,
                    frames_with_ball=analysis.frames_with_ball,
                    elapsed_s=round(time.perf_counter() - start, 2),
                    detector=detector.name,
                    imgsz=request.imgsz,
                ).model_dump()
            )
    except WebSocketDisconnect:
        pass


# --- Camera tab -------------------------------------------------------------


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
                detection = live_detector.detect(image, request.frame_id)
                inference_ms = (time.perf_counter() - start) * 1000

            response = DetectResponse(
                frame_id=request.frame_id,
                detection=detection,
                detector=live_detector.name,
                decode_ms=round(decode_ms, 3),
                inference_ms=round(inference_ms, 3),
                sent_at=request.sent_at,
            )
            await websocket.send_json(response.model_dump())
    except WebSocketDisconnect:
        # The frontend closed the tab or stopped the camera: nothing to report.
        pass
