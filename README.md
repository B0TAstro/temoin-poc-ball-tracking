# temoin-poc-ball-tracking

Exploration POC for tennis ball detection and tracking, part of the **Témoin**
project. See `CLAUDE.md` for the full project context (in French).

> Code and documentation are in English; everything displayed in the app is in French.

## Where we are

**Milestone 2 — a real pre-trained YOLO, with no fine-tuning.**

The app runs end to end and a real model answers: YOLO11, filtered to the COCO
"sports ball" class (index 32). Nothing has been retrained yet. The question being
asked is the first line of the CLAUDE.md table: what does an off-the-shelf YOLO see
of a tennis ball?

| Tab | State |
|---|---|
| **Camera** | live — webcam, real detection, trajectory drawn, performance figures |
| **Replay** | shell — structure in place, nothing wired (milestone 3) |
| **Training** | shell — settings shown but disabled (milestone 4) |

### Measured so far (Apple M2, 640x360 frames)

| | Milestone 1 (fake) | Milestone 2 (yolo11n) |
|---|---|---|
| Round trip | 0.3 ms | **14 ms** |
| of which JPEG decode | — | 0.2 ms |
| of which inference | 0.004 ms | 13.5 ms |

Budget is 66 ms per frame at 15 fps, so there is room left. `yolo11s` costs about
17.6 ms instead of 11.4 ms on the same frames, which is still comfortable.

**Picking the device matters more than picking the model.** On an M2, yolo11n takes
~200 ms per frame on the CPU and ~13 ms on the GPU via MPS — a 16x difference.
Ultralytics picked the CPU when left alone, so `detection/yolo.py` now chooses
explicitly (see `pick_device`).

Milestone 3: feed real video to the Replay tab, find bounces from the trajectory.

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

Then open `http://localhost:5173`, **Camera** tab, "Démarrer la caméra".

## How it is wired

```
camera → <video> → hidden canvas (scaled to 640px) → base64 JPEG
       → WebSocket ws://localhost:8000/ws/detect
       → frames.decode_jpeg()        turn the JPEG back into pixels
       → detector.detect()           fake.py or yolo.py, same interface
       → DetectResponse → overlay canvas (ball + trajectory)
```

Detectors are interchangeable behind the `Detector` protocol in
`backend/detection/__init__.py`. `fake.py` is kept on purpose: it is the latency
baseline to compare any real model against.

The data format is defined **twice, as mirrors**: `backend/schemas.py` and
`frontend/src/lib/types.ts`. Change one, change the other.

A few knobs, in `frontend/src/lib/useBallTracking.ts`:

- `CAPTURE_WIDTH` (640) — the width frames are sent at
- `TARGET_FPS` (15) — target frame rate; the per-frame budget is 1000/TARGET_FPS ms
- a frame is only sent once the previous answer is back, so lag does not pile up and
  skew the measured latency

And in `backend/detection/yolo.py`:

- `DEFAULT_CONF` (0.25) — boxes below this score are dropped. Kept deliberately low:
  better to see the weak detections and judge them than have the model hide them
- `SPORTS_BALL_CLASS` (32) — the COCO class we keep, out of 80

In `backend/detection/fake.py`:

- `MISS_RATE` (0.1) — one frame in ten with no ball, on purpose, so the frontend
  handles gaps from the start (gaps being the real tracking problem: interpolation,
  Kalman)

## Data

Nothing is versioned: `data/`, `models/` and `outputs/` are in `.gitignore` (image
rights, file sizes). There is no test video yet.
