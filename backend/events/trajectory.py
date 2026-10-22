"""
Reading events off a trajectory: bounces, hits, end of point.

The idea being tested here is the one from CLAUDE.md: does a change of vertical
direction suffice to find a bounce?

In image coordinates y grows downwards, so the lowest point of the ball is a
LOCAL MAXIMUM of y. Every bounce is one. So is every racket hit, which is why
a second signal is needed to tell them apart:

- at a bounce the ball keeps going the same way across the frame;
- at a hit it is sent back, so its horizontal direction reverses.

That distinction costs nothing and needs no court geometry. It will be worth
re-checking once the court lines exist (milestone 5), because a bounce happens
on the ground and a hit happens at a player.
"""

from schemas import BallDetection, Event

#: Window used to smooth the trajectory before looking for turning points,
#: in frames either side. Raw detections jitter by a pixel or two and would
#: otherwise produce a "bounce" every few frames.
SMOOTH_RADIUS = 2

#: The ball must have come down then gone back up by at least this many pixels
#: around a turning point for it to count. Filters out noise on a flat path.
MIN_PROMINENCE_PX = 6.0

#: Two turning points closer than this are the same event seen twice.
MIN_SPACING_FRAMES = 6

#: The track going quiet for this long, and never coming back, ends the point.
POINT_END_SILENCE_FRAMES = 15


def smooth_y(track: list[BallDetection]) -> dict[int, float]:
    """Moving average of y, by frame number."""
    smoothed: dict[int, float] = {}
    for index, detection in enumerate(track):
        low = max(index - SMOOTH_RADIUS, 0)
        high = min(index + SMOOTH_RADIUS + 1, len(track))
        window = track[low:high]
        smoothed[detection.frame] = sum(point.y for point in window) / len(window)
    return smoothed


def _prominence(track: list[BallDetection], index: int, smoothed: dict[int, float]) -> float:
    """How far the ball came down and went back up around `index`.

    Taking the smaller of the two sides means a real reversal is needed, not
    just a long descent that flattens out.
    """
    centre = smoothed[track[index].frame]
    low = max(index - SMOOTH_RADIUS * 3, 0)
    high = min(index + SMOOTH_RADIUS * 3 + 1, len(track))

    before = min((smoothed[track[i].frame] for i in range(low, index)), default=centre)
    after = min((smoothed[track[i].frame] for i in range(index + 1, high)), default=centre)
    return min(centre - before, centre - after)


def find_events(track: list[BallDetection], fps: float) -> list[Event]:
    """Bounces, hits and the end of the point, read off one trajectory."""
    if len(track) < SMOOTH_RADIUS * 4:
        return []

    smoothed = smooth_y(track)
    events: list[Event] = []
    last_frame = -MIN_SPACING_FRAMES

    for index in range(1, len(track) - 1):
        frame = track[index].frame
        if frame - last_frame < MIN_SPACING_FRAMES:
            continue

        y_here = smoothed[frame]
        y_before = smoothed[track[index - 1].frame]
        y_after = smoothed[track[index + 1].frame]

        # A turning point at the bottom: coming down, then going back up.
        going_down = y_here >= y_before
        coming_up = y_after < y_here
        if not (going_down and coming_up):
            continue

        prominence = _prominence(track, index, smoothed)
        if prominence < MIN_PROMINENCE_PX:
            continue

        # Did the ball carry on across the frame, or get sent back?
        dx_before = track[index].x - track[index - 1].x
        dx_after = track[index + 1].x - track[index].x
        reversed_x = dx_before * dx_after < 0

        # Interpolated points are guesses, so an event resting on them is worth
        # less. Confidence here is a reading aid, never a verdict.
        support = [track[i] for i in range(max(index - 2, 0), min(index + 3, len(track)))]
        measured = sum(1 for point in support if not point.interpolated) / len(support)
        confidence = round(min(0.95, 0.35 + 0.4 * measured + min(prominence / 60, 0.2)), 2)

        events.append(
            Event(
                type="hit" if reversed_x else "bounce",
                frame=frame,
                t=round(frame / fps, 4),
                x=round(track[index].x, 1),
                y=round(track[index].y, 1),
                conf=confidence,
            )
        )
        last_frame = frame

    end = _point_end(track, fps)
    if end is not None:
        events.append(end)

    return events


def _point_end(track: list[BallDetection], fps: float) -> Event | None:
    """Where the ball stops being seen for good.

    Crude on purpose: the real signal will come from the score announcement of
    the voice POC, and from the players' reaction. This is enough to pre-mark
    the replay timeline, which is what the VAR button needs.
    """
    if not track:
        return None

    last = track[-1]
    return Event(
        type="point_end",
        frame=last.frame,
        t=round(last.frame / fps, 4),
        x=round(last.x, 1),
        y=round(last.y, 1),
        # Low on purpose: "the ball stopped being detected" is not "the point
        # ended". It is a hint for the timeline, nothing more.
        conf=0.4,
    )
