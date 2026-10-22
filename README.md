# temoin-poc-ball-tracking

Exploration POC for tennis ball detection and tracking, part of the **Témoin**
project. See `CLAUDE.md` for the full project context (in French).

> Code and documentation are in English; everything displayed in the app is in French.

## Where we are

**Milestone 1 — the plumbing, with a fake detector.**

The app runs end to end: the camera opens, frames go to the server, detections come
back and are drawn live. But **the detection is made up**: the server loads no model
and does not even look at the image. The point of this milestone is to measure what
the round trip costs, before having a model at all.

| Tab | State |
|---|---|
| **Camera** | live — webcam, trajectory drawn, performance figures |
| **Replay** | shell — structure in place, nothing wired (milestone 3) |
| **Training** | shell — settings shown but disabled (milestone 4) |

Milestone 2: replace `backend/detection/fake.py` with a real pre-trained YOLO, and see
what image decoding and inference add to the latency measured here.

## Running it

Two terminals.

```bash
# terminal 1 — the server
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
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
       → fake.detect()  ← the only place to replace in milestone 2
       → DetectResponse → overlay canvas (ball + trajectory)
```

The data format is defined **twice, as mirrors**: `backend/schemas.py` and
`frontend/src/lib/types.ts`. Change one, change the other.

A few knobs, in `frontend/src/lib/useBallTracking.ts`:

- `CAPTURE_WIDTH` (640) — the width frames are sent at
- `TARGET_FPS` (15) — target frame rate; the per-frame budget is 1000/TARGET_FPS ms
- a frame is only sent once the previous answer is back, so lag does not pile up and
  skew the measured latency

And in `backend/detection/fake.py`:

- `MISS_RATE` (0.1) — one frame in ten with no ball, on purpose, so the frontend
  handles gaps from the start (gaps being the real tracking problem: interpolation,
  Kalman)

## Data

Nothing is versioned: `data/`, `models/` and `outputs/` are in `.gitignore` (image
rights, file sizes). There is no test video yet.
