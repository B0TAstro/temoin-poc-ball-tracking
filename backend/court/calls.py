"""
In or out, with the honesty the project demands.

Témoin never decides a point. So a line call here is not a verdict, it is a
reading: where the ball landed on the court, how far that is from the line, and
**how sure we can be**. When the margin is smaller than the uncertainty, the
answer is "too close to tell" — and that is a real answer, not a failure.

Where the uncertainty comes from, largest first:

1. **Time.** The bounce happens between two frames. At 60 images per second a
   ball doing 100 km/h travels 46 cm between them. Fitting the descent and the
   climb and intersecting them (see events.trajectory.refine_bounce) cuts this
   down a lot, but never to zero.
2. **The detector.** The ball's centre is found to within a few pixels, and
   near the far baseline one pixel is several centimetres of court.
3. **The calibration.** Four corners clicked by hand are a few pixels off, and
   the error grows with distance from them.

Only the first is estimated per bounce; the other two go in as a floor.
"""

from dataclasses import dataclass
from typing import Literal

import numpy as np

from court import model
from court.geometry import to_court

#: Everything the detector and the hand-clicked calibration cost us, in metres.
#: A deliberately round, pessimistic figure: it has not been measured against
#: labelled data, and saying so is better than pretending to a precision we
#: have not earned.
BASE_UNCERTAINTY_M = 0.06

Verdict = Literal["in", "out", "too_close"]


@dataclass
class LineCall:
    """One bounce, read on the court plane."""

    frame: float  # fractional: the bounce falls between two frames
    t: float
    court_x: float  # metres, across the court
    court_y: float  # metres, along the court
    #: Positive inside, negative outside. Distance from the ball's centre to
    #: the nearest boundary of the court being played.
    margin_m: float
    nearest_line: str
    verdict: Verdict
    uncertainty_m: float
    #: False when the bounce could not be pinned down between frames, which
    #: roughly doubles the uncertainty.
    refined: bool


def _nearest_boundary(x: float, y: float, half_width: float) -> tuple[float, str]:
    """Distance to the closest boundary line, and which one it is.

    Positive means inside. Taking the smallest of the two keeps the call
    conservative: a ball can be comfortably inside the sidelines and still long.
    """
    to_sideline = half_width - abs(x)
    to_baseline = model.HALF_LENGTH - abs(y)

    if to_sideline <= to_baseline:
        side = "right" if x > 0 else "left"
        return to_sideline, f"sideline_{side}"

    end = "far" if y > 0 else "near"
    return to_baseline, f"baseline_{end}"


def call_bounce(
    matrix: np.ndarray,
    image_x: float,
    image_y: float,
    frame: float,
    fps: float,
    speed_px_per_frame: float,
    refined: bool,
    singles: bool = True,
) -> LineCall:
    """Read one bounce on the court plane and say what can be said about it."""
    court_x, court_y = to_court(matrix, image_x, image_y)

    half_width = model.HALF_WIDTH_SINGLES if singles else model.HALF_WIDTH_DOUBLES
    margin, nearest = _nearest_boundary(court_x, court_y, half_width)

    # Turn the ball's speed in pixels into metres, right here on the court, by
    # measuring how far one pixel is worth around this very bounce. Doing it
    # locally matters: a pixel near the far baseline covers far more ground
    # than one at the near baseline.
    nearby_x, nearby_y = to_court(matrix, image_x + 10, image_y)
    metres_per_pixel = (
        (nearby_x - court_x) ** 2 + (nearby_y - court_y) ** 2
    ) ** 0.5 / 10

    speed_m_per_frame = speed_px_per_frame * metres_per_pixel
    # Half a frame if we pinned the bounce down between frames, a whole one if
    # we are stuck on the frame itself.
    time_uncertainty = speed_m_per_frame * (0.25 if refined else 0.5)
    uncertainty = BASE_UNCERTAINTY_M + time_uncertainty

    # The rule is that a ball touching any part of the line is in, so the real
    # boundary sits one ball radius outside the paint.
    effective = margin + model.BALL_RADIUS

    if abs(effective) <= uncertainty:
        verdict: Verdict = "too_close"
    elif effective > 0:
        verdict = "in"
    else:
        verdict = "out"

    return LineCall(
        frame=round(frame, 2),
        t=round(frame / fps, 4) if fps else 0.0,
        court_x=round(court_x, 3),
        court_y=round(court_y, 3),
        margin_m=round(margin, 3),
        nearest_line=nearest,
        verdict=verdict,
        uncertainty_m=round(uncertainty, 3),
        refined=refined,
    )
