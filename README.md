# temoin-poc-ball-tracking

Exploration POC for tennis ball detection and tracking, part of the **Témoin**
project. See `CLAUDE.md` for the full project context (in French).

> Code and documentation are in English; everything displayed in the app is in French.

## Where we are

**Milestone 5 — the court is calibrated, and bounces are read on it in metres.**

| Tab | State |
|---|---|
| **Camera** | live — webcam, detection, trajectory, performance figures |
| **Replay** | live — analyse, replay frame by frame, bounces, hits, and line calls |
| **Training** | shell — settings shown but disabled |

Click the four outer court corners once and the homography follows: every pixel on the
floor can then be read as a position in metres. The court model is drawn back over the
picture, which is the calibration checking itself — if those lines land on the painted
ones, the corners were right. On the test clips they do.

Automatic line detection is the goal, not what this does. Classical Hough on a
broadcast frame finds the court lines perfectly well, but it also finds the crowd, the
advertising boards and — worst — the net, whose mesh alone produces about a hundred
segments (see `outputs/inspection/lines/`). The hard part is not finding lines, it is
knowing which is which, and that is circular: naming them needs the court model fitted,
and fitting it needs four named points. Clicking them breaks the circle, and in the real
app the phone sits still for a whole match, so calibrating once at setup is an
acceptable step — and the player *sees* the model land on the lines instead of trusting
a black box, which is the point of Témoin.

### Saying how sure we are

A line call here is a reading, never a verdict. It comes with its uncertainty, and when
the margin is smaller than that uncertainty the answer is **"trop juste"** — which is an
answer, not a failure.

Where the uncertainty comes from, largest first:

1. **Time.** A bounce happens *between* two frames. At 60 fps a ball doing 100 km/h
   travels 46 cm between them, so the frame alone places the landing spot within half a
   metre — useless for a line call. `refine_bounce` cuts this down by fitting the
   descent and the climb and intersecting them. Note it fits two lines and crosses them
   rather than one curve through the middle: **a bounce is a corner, not a smooth
   turning point**, and a single parabola rounds it off and moves the answer.
2. **The detector**, a few pixels on the ball's centre — several centimetres of court
   near the far baseline.
3. **The calibration**, a few pixels on each clicked corner.

Only the first is estimated per bounce; the other two go in as a 6 cm floor. That floor
is a round pessimistic guess, not a measurement, and saying so is better than claiming
a precision we have not earned.

Measured on the test clips, the uncertainty comes out at **6 to 12 cm** per bounce, with
5 of 7 bounces pinned down to better than a frame on clip 01.

### What is still wrong

- **Several "bounces" are not bounces.** On clip 01, two of them land 1.3 m and 4.1 m
  past the net — nowhere a ball bounces in a normal rally. They are racket hits, or
  false turning points in a short run. The geometry is right; the event detection
  feeding it is the weak link.
- **The court can now police that**, and does not yet: a bounce must happen somewhere
  plausible on the floor, and a hit happens where a player is. That check is the obvious
  next step and it costs almost nothing now that the homography exists.
- **Hits remain under-detected** (see milestone 4): 7 bounces to 1 hit on clip 01.
- **No ground truth** anywhere. Every judgement is still by eye, on three broadcast
  clips.

### Cost

| | per frame |
|---|---|
| fake detector | 0.004 ms |
| live, yolo11n @ 640 | ~14 ms |
| replay, yolo11s @ 1920 | ~106 ms |

The live budget is 66 ms per frame at 15 fps. Replay has no budget: a 15 s clip at
60 fps takes about 100 seconds. Calibration and line calls are a separate request, so
re-clicking the corners costs milliseconds, not another analysis.

**Picking the device matters more than picking the model.** On an M2, yolo11n takes
~200 ms per frame on the CPU and ~13 ms on the GPU via MPS — a 16x difference.
Ultralytics picked the CPU when left alone, so `detection/yolo.py` chooses explicitly
(see `pick_device`).

Next: automatic court detection, judged against the clicked calibration as ground truth.

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
baseline to compare any real model against, and its Lissajous curve doubles as a test
oracle — 5.5 oscillations over 214 frames, and the bounce detector finds 6 turning
points.

Court calibration and line calls, once a trajectory exists:

```
four clicked corners (source-frame pixels)
       → POST /api/line-calls   with the timeline the frontend already holds
       → court.homography_from_corners()   four points fix the plane exactly
       → events.refine_bounce()            pin each bounce between frames
       → court.call_bounce()               position in metres, margin, uncertainty
       → court lines projected back + one call per bounce
```

`backend/court/` is pure geometry: give it four corners and it works, whether a human
clicked them or a model found them. That is deliberate, so automatic detection can slot
in later without touching anything else.

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
