"""
Turning per-frame candidates into one trajectory.

A detector answers each frame on its own, so it cannot tell a tennis ball from
anything else round and bright. Measured on a broadcast clip: a yellow
advertising panel at the edge of the court was detected as a "sports ball" on
100% of frames and outscored the real ball on 69% of them.

What the detector cannot see, a trajectory can: a tennis ball never stays put,
and it never crosses the frame in one step. This module uses those two facts.

Three steps, in order:

1. `reject_static`   — drop candidates that sit in the same place all clip long.
                       That is furniture: a panel, a logo, a bag.
2. `find_segments`   — among what is left, pick the sequences of candidates
                       that move plausibly. Several, not one: during a rally
                       the ball goes out of sight and comes back, so a point is
                       made of a handful of separate runs.
3. `interpolate`     — fill the short gaps inside a run, flagged as guessed.
                       Never across two runs: the ball did something in
                       between and we have no idea what.
"""

from dataclasses import dataclass, field

from schemas import BallDetection

#: Two candidates closer than this are treated as the same object.
STATIC_TOLERANCE_PX = 30.0

#: A thing present at the same spot on more than this share of the clip is not
#: a ball. A 15 s point gives the ball no reason to sit still for 4 s.
STATIC_FRAME_RATIO = 0.25

#: Top speed, as a share of the frame width, per frame, at 60 fps. A serve at
#: 200 km/h crosses roughly this much. Scaled for other frame rates below.
MAX_SPEED_WIDTH_RATIO = 0.08

#: Never link two detections more than this many frames apart: beyond it we
#: have no idea whether it is still the same ball.
MAX_LINK_GAP = 12

#: Gaps up to this length get interpolated. Longer ones stay empty — guessing
#: a whole second of flight would be inventing, not estimating.
MAX_INTERPOLATE_GAP = 8

#: A run shorter than this is noise, not a glimpse of the ball.
MIN_SEGMENT_LENGTH = 4

#: Each frame skipped costs this much score, so a path through consecutive
#: frames beats one that hops about.
GAP_PENALTY = 0.15


def max_speed(frame_width: int, fps: float) -> float:
    """How far the ball may travel between two frames, in pixels.

    Lower frame rates leave more time between frames, so they allow more
    movement: the whole point is a physical limit, not a per-frame one.
    """
    return frame_width * MAX_SPEED_WIDTH_RATIO * (60.0 / max(fps, 1.0))


@dataclass
class Cluster:
    """Candidates that keep showing up in the same place."""

    x: float
    y: float
    frames: set[int] = field(default_factory=set)
    count: int = 0

    def absorb(self, candidate: BallDetection) -> None:
        # Running average, so the centre follows a slowly drifting object.
        self.x = (self.x * self.count + candidate.x) / (self.count + 1)
        self.y = (self.y * self.count + candidate.y) / (self.count + 1)
        self.count += 1
        self.frames.add(candidate.frame)

    def holds(self, candidate: BallDetection) -> bool:
        return (
            abs(candidate.x - self.x) <= STATIC_TOLERANCE_PX
            and abs(candidate.y - self.y) <= STATIC_TOLERANCE_PX
        )


def reject_static(
    per_frame: list[list[BallDetection]], total_frames: int
) -> tuple[list[list[BallDetection]], list[Cluster]]:
    """Remove candidates belonging to something that does not move.

    Returns the filtered candidates and the clusters that were rejected, so the
    interface can say what was thrown away and why.
    """
    clusters: list[Cluster] = []
    for candidates in per_frame:
        for candidate in candidates:
            for cluster in clusters:
                if cluster.holds(candidate):
                    cluster.absorb(candidate)
                    break
            else:
                clusters.append(Cluster(x=candidate.x, y=candidate.y))
                clusters[-1].absorb(candidate)

    threshold = max(STATIC_FRAME_RATIO * total_frames, 3)
    rejected = [cluster for cluster in clusters if len(cluster.frames) >= threshold]

    if not rejected:
        return per_frame, []

    kept = [
        [
            candidate
            for candidate in candidates
            if not any(cluster.holds(candidate) for cluster in rejected)
        ]
        for candidates in per_frame
    ]
    return kept, rejected


def best_path(
    per_frame: list[list[BallDetection]], frame_width: int, fps: float
) -> list[BallDetection]:
    """Pick the most plausible sequence of candidates, one per frame at most.

    This is a shortest-path problem in disguise, solved with dynamic
    programming: the score of landing on a candidate is its own confidence plus
    the best score of any reachable candidate before it. "Reachable" means the
    ball could physically have travelled that far in that many frames.

    Picking the most confident box per frame — what we did before — has no idea
    of any of this, which is exactly how a stationary panel won.
    """
    limit = max_speed(frame_width, fps)

    # Flatten to (frame index, candidate) so the DP can look backwards easily.
    nodes: list[tuple[int, BallDetection]] = [
        (index, candidate)
        for index, candidates in enumerate(per_frame)
        for candidate in candidates
    ]
    if not nodes:
        return []

    scores = [0.0] * len(nodes)
    previous: list[int | None] = [None] * len(nodes)

    for i, (frame_i, candidate_i) in enumerate(nodes):
        scores[i] = candidate_i.conf  # starting a fresh path here
        for j in range(i - 1, -1, -1):
            frame_j, candidate_j = nodes[j]
            elapsed = frame_i - frame_j
            if elapsed <= 0:
                continue  # same frame: only one of them can be the ball
            if elapsed > MAX_LINK_GAP:
                break  # nodes are ordered, everything earlier is too far back

            distance = (
                (candidate_i.x - candidate_j.x) ** 2
                + (candidate_i.y - candidate_j.y) ** 2
            ) ** 0.5
            if distance > limit * elapsed:
                continue  # the ball cannot have moved that fast

            score = scores[j] + candidate_i.conf - GAP_PENALTY * (elapsed - 1)
            if score > scores[i]:
                scores[i] = score
                previous[i] = j

    # Walk back from the best end point.
    end = max(range(len(nodes)), key=lambda i: scores[i])
    path: list[BallDetection] = []
    cursor: int | None = end
    while cursor is not None:
        path.append(nodes[cursor][1])
        cursor = previous[cursor]
    path.reverse()
    return path


def find_segments(
    per_frame: list[list[BallDetection]], frame_width: int, fps: float
) -> list[list[BallDetection]]:
    """Every plausible run of the ball, longest-scoring first.

    `best_path` returns one run. A rally gives several: the ball is lost behind
    a player, leaves the frame, blurs into the court, then shows up again.
    Taking only the best run covered 3.5 s of a 15.5 s point, so we take the
    best, set those frames aside, and look again in what is left.

    Frames are claimed rather than candidates: there is only ever one ball, so
    once a run has claimed a frame no other run may use it.
    """
    remaining = [list(candidates) for candidates in per_frame]
    segments: list[list[BallDetection]] = []

    while True:
        path = best_path(remaining, frame_width, fps)
        if len(path) < MIN_SEGMENT_LENGTH:
            break

        segments.append(path)
        for detection in path:
            remaining[detection.frame] = []

    return segments


def interpolate(track: list[BallDetection], fps: float) -> list[BallDetection]:
    """Fill short gaps with straight lines, flagged as guessed.

    Straight lines are wrong in principle — a ball flies in an arc — but over
    the handful of frames we allow, the error is smaller than the detector's
    own. `interpolated` is set so nothing downstream mistakes these for
    measurements.
    """
    if len(track) < 2:
        return list(track)

    filled: list[BallDetection] = []
    for current, following in zip(track, track[1:]):
        filled.append(current)
        missing = following.frame - current.frame - 1
        if not 0 < missing <= MAX_INTERPOLATE_GAP:
            continue

        for step in range(1, missing + 1):
            ratio = step / (missing + 1)
            frame = current.frame + step
            filled.append(
                BallDetection(
                    frame=frame,
                    t=round(frame / fps, 4),
                    x=round(current.x + (following.x - current.x) * ratio, 1),
                    y=round(current.y + (following.y - current.y) * ratio, 1),
                    # No measurement backs this up, so no confidence either.
                    conf=0.0,
                    interpolated=True,
                )
            )
    filled.append(track[-1])
    return filled


@dataclass
class TrackingResult:
    track: list[BallDetection]
    rejected_static: list[Cluster]
    frames_with_candidate: int
    frames_detected: int  # frames a run actually picked, before filling
    frames_interpolated: int
    segments: int  # how many separate runs the point was made of


def build_track(
    per_frame: list[list[BallDetection]],
    frame_width: int,
    fps: float,
    total_frames: int,
) -> TrackingResult:
    """The whole pipeline: reject furniture, find the runs, fill the gaps."""
    frames_with_candidate = sum(1 for candidates in per_frame if candidates)

    kept, rejected = reject_static(per_frame, total_frames)
    segments = find_segments(kept, frame_width, fps)

    # Interpolate inside each run, then put them back in frame order.
    track: list[BallDetection] = []
    detected = 0
    for segment in segments:
        detected += len(segment)
        track.extend(interpolate(segment, fps))
    track.sort(key=lambda detection: detection.frame)

    return TrackingResult(
        track=track,
        rejected_static=rejected,
        frames_with_candidate=frames_with_candidate,
        frames_detected=detected,
        frames_interpolated=len(track) - detected,
        segments=len(segments),
    )
