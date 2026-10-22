"""
The tennis court, in metres.

Official ITF dimensions. Having them written down once is what makes a line
call possible at all: the court is the only thing in the picture whose real
size we know for certain, so it is our ruler.

Coordinate system, in metres:

    origin  = the centre of the net
    x       = across the court, positive to the right
    y       = along the court, positive away from the camera

              x=-5.485        x=0        x=+5.485
    y=+11.885   +--------------+--------------+   far doubles baseline
                |    |         |         |    |
    y=+6.40     |    +---------+---------+    |   far service line
                |    |         |         |    |
    y=0         +====+=========+=========+====+   net
                |    |         |         |    |
    y=-6.40     |    +---------+---------+    |   near service line
                |    |         |         |    |
    y=-11.885   +--------------+--------------+   near doubles baseline

                     x=-4.115       x=+4.115       singles sidelines
"""

#: Half the court length, net to baseline.
HALF_LENGTH = 11.885

#: Half width, outer tramlines (doubles).
HALF_WIDTH_DOUBLES = 5.485

#: Half width, inner lines (singles).
HALF_WIDTH_SINGLES = 4.115

#: Service line distance from the net.
SERVICE_LINE = 6.40

#: A tennis ball is 6.54 to 6.86 cm across, so this is its radius in metres.
#: It matters: the rule is that a ball touching any part of the line is in, so
#: the real boundary sits one radius outside the painted line.
BALL_RADIUS = 0.0335

#: The four outer corners, in the order the interface asks for them:
#: near-left, near-right, far-right, far-left. Clockwise seen from the camera,
#: starting at the corner closest to the bottom-left of the picture.
DOUBLES_CORNERS = [
    (-HALF_WIDTH_DOUBLES, -HALF_LENGTH),
    (+HALF_WIDTH_DOUBLES, -HALF_LENGTH),
    (+HALF_WIDTH_DOUBLES, +HALF_LENGTH),
    (-HALF_WIDTH_DOUBLES, +HALF_LENGTH),
]

#: Every painted line, as a pair of endpoints in court metres. Drawn over the
#: image once calibrated, which is how you check the calibration by eye: if
#: these land on the real lines, the homography is right.
LINES: list[tuple[str, tuple[float, float], tuple[float, float]]] = [
    # Baselines and doubles sidelines: the outer rectangle.
    ("baseline_near", (-HALF_WIDTH_DOUBLES, -HALF_LENGTH), (+HALF_WIDTH_DOUBLES, -HALF_LENGTH)),
    ("baseline_far", (-HALF_WIDTH_DOUBLES, +HALF_LENGTH), (+HALF_WIDTH_DOUBLES, +HALF_LENGTH)),
    ("doubles_left", (-HALF_WIDTH_DOUBLES, -HALF_LENGTH), (-HALF_WIDTH_DOUBLES, +HALF_LENGTH)),
    ("doubles_right", (+HALF_WIDTH_DOUBLES, -HALF_LENGTH), (+HALF_WIDTH_DOUBLES, +HALF_LENGTH)),
    # Singles sidelines.
    ("singles_left", (-HALF_WIDTH_SINGLES, -HALF_LENGTH), (-HALF_WIDTH_SINGLES, +HALF_LENGTH)),
    ("singles_right", (+HALF_WIDTH_SINGLES, -HALF_LENGTH), (+HALF_WIDTH_SINGLES, +HALF_LENGTH)),
    # Service lines and the centre service line.
    ("service_near", (-HALF_WIDTH_SINGLES, -SERVICE_LINE), (+HALF_WIDTH_SINGLES, -SERVICE_LINE)),
    ("service_far", (-HALF_WIDTH_SINGLES, +SERVICE_LINE), (+HALF_WIDTH_SINGLES, +SERVICE_LINE)),
    ("centre_service", (0.0, -SERVICE_LINE), (0.0, +SERVICE_LINE)),
    # The net, for reading the picture.
    ("net", (-HALF_WIDTH_DOUBLES, 0.0), (+HALF_WIDTH_DOUBLES, 0.0)),
]
