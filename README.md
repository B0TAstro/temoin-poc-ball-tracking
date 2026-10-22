# temoin-poc-ball-tracking

Exploration POC for tennis ball detection and tracking, part of the **Témoin**
project. See `CLAUDE.md` for the full project context (in French).

> Code and documentation are in English; everything displayed in the app is in French.

## Where we are

**Milestone 4 — a trajectory that actually follows the ball, and the events on it.**

| Tab | State |
|---|---|
| **Camera** | live — webcam, detection, trajectory, performance figures |
| **Replay** | live — analyse a video, replay frame by frame, bounces and hits |
| **Training** | shell — settings shown but disabled |

### The thing milestone 3 got wrong

Milestone 3 reported a 100 % detection rate on one clip. It was wrong, and the way it
was wrong is the most useful thing measured so far.

A **yellow advertising panel** at the edge of the court was detected as a COCO "sports
ball" on **100 % of frames**, and it outscored the real ball on 69 % of them. Since the
detector kept only the most confident box per frame, we were tracking the panel. The
giveaway was in the trajectory: median movement of **0.0 px per frame** (a ball that
never moves), a 90th percentile of 591 px (and teleports), and 42 vertical direction
changes in a 15 s point where 2 to 10 are expected.

Two lessons, both now baked into the code:

- **A detection rate means nothing on its own.** It counts boxes, not correct boxes.
- **What a detector cannot see, a trajectory can.** A tennis ball never stays put and
  never crosses the frame in one step. Those two facts separate the ball from the
  furniture, and no single frame can.

### What the tracking does

`backend/tracking.py`, three steps:

1. **`reject_static`** — cluster candidates by position over the whole clip; anything
   sitting in the same spot for more than 25 % of it is furniture, not a ball.
2. **`find_segments`** — a shortest-path search (dynamic programming) over the
   remaining candidates: score a candidate by its confidence plus the best reachable
   predecessor, where "reachable" means the ball could physically have covered that
   distance in that many frames. Then set those frames aside and search again, because
   a rally is made of several runs — the ball goes behind a player, leaves the frame,
   blurs into the court, comes back.
3. **`interpolate`** — fill gaps of up to 8 frames inside a run, flagged
   `interpolated: true`. Never across two runs.

Then `backend/events/trajectory.py` reads the turning points. In image coordinates y
grows downwards, so the ball's lowest point is a **local maximum of y** — every bounce
is one, and so is every racket hit. They are told apart by the horizontal direction: at
a bounce the ball carries on across the frame, at a hit it is sent back.

### What it changed

| Clip | detector said | tracking kept | + interpolated | runs |
|---|---|---|---|---|
| `point_01` (929 fr, 60 fps) | 100 % | **39.8 %** | 57.8 % | 12 |
| `point_02` (214 fr, 30 fps) | 97.7 % | **52.3 %** | 93.9 % | 1 |
| `point_03` (416 fr, 24 fps) | 30.0 % | **28.4 %** | 42.1 % | 3 |

The rates went *down*, which is the point: they are now honest. And the trajectory
became physically plausible — on clip 01, median movement per frame went from 0.0 px to
5.2 px and the maximum from 1104 px to 30.6 px, under a physical limit of 154.

Drawn as a long exposure (see `outputs/inspection/`), the paths read as tennis: arcs
with an apex, net crossings, direction reversals, bounces marked at the bottom of each
descent.

### What is still wrong

- **Hits are under-detected.** Clip 01 gives 7 bounces and 1 hit, but a rally with 7
  bounces has about as many hits. A hit happens next to a player, where the ball is
  often hidden, so the turning point is missed. Telling the two apart properly needs
  the court lines, or the players' positions.
- **No ground truth.** Nothing here is checked against labelled data. Every judgement
  so far is by eye, on three broadcast clips.
- **Interpolation draws straight lines** where a ball flies in an arc. Over 8 frames
  the error stays below the detector's own, but it is still wrong in principle.
- **The Camera tab still has this problem**, and cannot be fixed the same way: picking
  the right candidate needs frames that have not happened yet.

### Cost

| | per frame |
|---|---|
| fake detector | 0.004 ms |
| live, yolo11n @ 640 | ~14 ms |
| replay, yolo11s @ 1920 | ~106 ms |

The live budget is 66 ms per frame at 15 fps. Replay has no budget: a 15 s clip at
60 fps takes about 100 seconds, fine for a tool you watch afterwards.

**Picking the device matters more than picking the model.** On an M2, yolo11n takes
~200 ms per frame on the CPU and ~13 ms on the GPU via MPS — a 16x difference.
Ultralytics picked the CPU when left alone, so `detection/yolo.py` chooses explicitly
(see `pick_device`).

Milestone 5: court lines and homography, to finally answer "in or out".

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

In `backend/tracking.py`, the two that decide what counts as a ball:

- `STATIC_FRAME_RATIO` (0.25) — present at one spot for more than this share of the
  clip and it is furniture
- `MAX_SPEED_WIDTH_RATIO` (0.08) — top speed as a share of frame width per frame at
  60 fps, scaled for other frame rates. A serve at 200 km/h covers roughly this much

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
