# temoin-poc-ball-tracking

Exploration POC for tennis ball detection and tracking, part of the **Témoin**
project. See `CLAUDE.md` for the full project context (in French).

> Code and documentation are in English; everything displayed in the app is in French.

## Where we are

**Milestone 3 — the Replay tab: analyse a video, replay it with the trajectory.**

Pick one of the test clips or drop your own, the server runs the detector over every
frame and streams back the timeline described in CLAUDE.md. The player then replays it
in slow motion, frame by frame, with the trajectory drawn on top and a timeline bar
showing where the ball was found.

| Tab | State |
|---|---|
| **Camera** | live — webcam, real detection, trajectory, performance figures |
| **Replay** | live — pick or drop a video, analyse it, replay frame by frame |
| **Training** | shell — settings shown but disabled (milestone 5) |

Hits, bounces and end of point are not detected yet: they come from analysing the
trajectory, which is milestone 4. The timeline bar is already where they will go.

### What the measurements say

Detection rate of an off-the-shelf YOLO (COCO "sports ball" class, nothing retrained)
on the three broadcast test clips, all 1920x1080:

| Clip | frames | yolo11n @ 1920 | yolo11s @ 1920 |
|---|---|---|---|
| `broadcast_point_01.mp4` (60 fps) | 929 | 16.8 % | **100.0 %** |
| `broadcast_point_02.mp4` (30 fps) | 214 | 25.7 % | 97.7 % |
| `broadcast_point_03.mov` (24 fps) | 416 | 14.7 % | **30.0 %** |

Two things to take from this, and one warning.

**Analysis size decides everything.** On clip 02, yolo11n found the ball on 0 % of
frames at 640 px, 13 % at 1280, 26 % at 1920. A tennis ball at broadcast distance is
a handful of pixels; scale the frame down and there is simply nothing left to detect.

**Model size matters at least as much.** yolo11s beats yolo11n by 4x to 6x on the same
frames. Going further up does not help: yolo11m scored *worse* than yolo11s (36 % vs
98 % on clip 02) while costing twice as much.

**But the result is not stable across clips.** 100 % on one clip and 30 % on another,
with the same model and size. So "a pre-trained YOLO is enough" is not yet an answer —
what varies between those clips (camera angle, how big the ball is on screen, contrast
against the court) is the next thing to understand. That is what the Replay tab is for.

A high rate also does not mean the right object was found: it means *a* sports ball was
found. Watching the trajectory is the only way to tell. If it jumps around the frame,
the model is following something else.

### Cost

| | Milestone 1 (fake) | Milestone 2 (live, yolo11n @ 640) | Milestone 3 (replay, yolo11s @ 1920) |
|---|---|---|---|
| Per frame | 0.004 ms | 13.5 ms | ~106 ms |

The live budget is 66 ms per frame at 15 fps. Replay has no budget: a 15 s clip at
60 fps takes about 100 seconds to analyse, which is fine for a tool you watch afterwards.

**Picking the device matters more than picking the model.** On an M2, yolo11n takes
~200 ms per frame on the CPU and ~13 ms on the GPU via MPS — a 16x difference.
Ultralytics picked the CPU when left alone, so `detection/yolo.py` now chooses
explicitly (see `pick_device`).

Milestone 4: find hits and bounces from the trajectory.

## Running it

Two terminals.

```bash
# terminal 1 — the server
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Weights (`yolo11n.pt`, 5.4 MB) download themselves into `models/` on first run.

Two environment variables swap things out without touching the frontend:

```bash
DETECTOR=fake uvicorn main:app      # milestone 1 baseline, no model at all
DETECTOR=yolo11s uvicorn main:app   # bigger model
DEVICE=cpu uvicorn main:app         # to see for yourself how much MPS buys
```

> **Python 3.12**, not newer: `pydantic-core` has no wheel for 3.14 yet (it falls back
> to building Rust and fails), and in milestone 2 Ultralytics/PyTorch will also be
> safer on 3.12.

```bash
# terminal 2 — the frontend
cd frontend
npm install
npm run dev
```

Then open `http://localhost:5173`.

For the Replay tab you need something to analyse:

```bash
python scripts/fetch_sample_videos.py   # three real tennis clips into data/videos/
```

These are clips committed in public tennis-tracking repositories. They are **broadcast
footage**, camera high above the court — the app will see a phone at ground level, on
the side or behind the baseline. A model that works on these will not necessarily work
there, so treat them as a starting point, not as the target.

## How it is wired

Camera tab, one frame at a time, as fast as it can:

```
camera → <video> → hidden canvas (scaled to 640px) → base64 JPEG
       → WebSocket /ws/detect
       → frames.decode_jpeg()   turn the JPEG back into pixels
       → detector.detect()      fake.py or yolo.py, same interface
       → DetectResponse → overlay canvas (ball + trajectory)
```

Replay tab, a whole file, no hurry:

```
file (picked or dropped) → POST /api/videos → data/videos/
       → WebSocket /ws/analyze
       → video.VideoAnalysis    walks every frame with OpenCV
       → AnalyzeProgress ...    streamed while it runs
       → AnalyzeDone            the Timeline from CLAUDE.md
       → <video src=/videos/…> + overlay canvas, driven by frame number
```

The link between video and timeline is the frame number: the player knows a time in
seconds, the timeline knows frames, and `fps` converts between them. That is what the
`fps` field is for.

Detectors are interchangeable behind the `Detector` protocol in
`backend/detection/__init__.py`. `fake.py` is kept on purpose: it is the latency
baseline to compare any real model against.

The data format is defined **twice, as mirrors**: `backend/schemas.py` and
`frontend/src/lib/types.ts`. Change one, change the other.

A few knobs for the Camera tab, in `frontend/src/lib/useBallTracking.ts`:

- `CAPTURE_WIDTH` (640) — the width frames are sent at
- `TARGET_FPS` (15) — target frame rate; the per-frame budget is 1000/TARGET_FPS ms
- a frame is only sent once the previous answer is back, so lag does not pile up and
  skew the measured latency

And in `backend/detection/yolo.py`:

- `DEFAULT_CONF` (0.25) — boxes below this score are dropped. Kept deliberately low:
  better to see the weak detections and judge them than have the model hide them
- `SPORTS_BALL_CLASS` (32) — the COCO class we keep, out of 80
- `DEFAULT_IMGSZ` (640) — the live default. The Replay tab asks for more, picked in
  the UI; see the table above for why that is the setting that matters most

In `backend/detection/fake.py`:

- `MISS_RATE` (0.1) — one frame in ten with no ball, on purpose, so the frontend
  handles gaps from the start (gaps being the real tracking problem: interpolation,
  Kalman)

## Data

Nothing is versioned: `data/`, `models/` and `outputs/` are in `.gitignore` (image
rights, file sizes). There is no test video yet.
