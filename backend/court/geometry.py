"""
Going from the picture to the court, and back.

A homography is the 3x3 matrix that maps one flat plane onto another seen from
somewhere else. The court floor is flat, so four pairs of matching points —
four corners we can name in both the picture and the real court — are enough to
pin it down completely. After that, any pixel on the floor can be read as a
position in metres.

Everything here is pure geometry: give it the four corners and it works, no
matter whether a human clicked them or a model found them. That is deliberate,
so automatic court detection can slot in later without touching the rest.
"""

import cv2
import numpy as np

from court.model import DOUBLES_CORNERS


class CalibrationError(ValueError):
    """The four points given do not describe a court."""


#: Below this, in square pixels, the four points are too close to a line (or to
#: each other) for the geometry to mean anything.
MIN_QUAD_AREA_PX = 2000.0


def _signed_areas(corners: list[tuple[float, float]]) -> list[float]:
    """Cross product at each corner. All the same sign means convex."""
    areas = []
    for i in range(4):
        ax, ay = corners[i]
        bx, by = corners[(i + 1) % 4]
        cx, cy = corners[(i + 2) % 4]
        areas.append((bx - ax) * (cy - by) - (by - ay) * (cx - bx))
    return areas


def _check_quad(corners: list[tuple[float, float]]) -> None:
    """Refuse anything that is not a proper quadrilateral.

    cv2.getPerspectiveTransform happily returns a finite matrix for four points
    in a line, and every reading taken from it is then nonsense. Two things are
    checked here, and both correspond to a mistake a user really makes:

    - too flat or too small: three corners nearly in a line, or two clicks on
      top of each other;
    - not convex: the corners were clicked in the wrong order, which folds the
      quadrilateral into a bowtie.
    """
    # Shoelace area of the quadrilateral.
    area = 0.0
    for i in range(4):
        x1, y1 = corners[i]
        x2, y2 = corners[(i + 1) % 4]
        area += x1 * y2 - x2 * y1
    area = abs(area) / 2

    if area < MIN_QUAD_AREA_PX:
        raise CalibrationError(
            "ces quatre points sont presque alignés ou confondus : "
            f"aire {area:.0f} px², il en faut au moins {MIN_QUAD_AREA_PX:.0f}"
        )

    signs = [area_at > 0 for area_at in _signed_areas(corners)]
    if len(set(signs)) != 1:
        raise CalibrationError(
            "les coins se croisent : clique-les dans l'ordre "
            "proche-gauche, proche-droite, loin-droite, loin-gauche"
        )


def homography_from_corners(
    image_corners: list[tuple[float, float]],
) -> np.ndarray:
    """Build the image -> court matrix from the four outer court corners.

    `image_corners` are in pixels, in the same order as `DOUBLES_CORNERS`:
    near-left, near-right, far-right, far-left.
    """
    # These messages reach the interface, so they are in French like every
    # other string the user reads.
    if len(image_corners) != 4:
        raise CalibrationError(
            f"il faut quatre coins, {len(image_corners)} donné(s)"
        )

    _check_quad(image_corners)

    source = np.array(image_corners, dtype=np.float64)
    target = np.array(DOUBLES_CORNERS, dtype=np.float64)

    # Four points exactly determine the matrix, so there is nothing to fit and
    # no outlier to reject: getPerspectiveTransform is the right tool.
    matrix = cv2.getPerspectiveTransform(
        source.astype(np.float32), target.astype(np.float32)
    )

    if not np.isfinite(matrix).all():
        raise CalibrationError("ces quatre points ne forment pas un court")

    return matrix.astype(np.float64)


def to_court(matrix: np.ndarray, x: float, y: float) -> tuple[float, float]:
    """Read one image pixel as a position on the court floor, in metres."""
    point = np.array([[[x, y]]], dtype=np.float64)
    mapped = cv2.perspectiveTransform(point, matrix)
    return float(mapped[0][0][0]), float(mapped[0][0][1])


def to_image(matrix: np.ndarray, x: float, y: float) -> tuple[float, float]:
    """Place a court position, in metres, back into the picture."""
    inverse = np.linalg.inv(matrix)
    point = np.array([[[x, y]]], dtype=np.float64)
    mapped = cv2.perspectiveTransform(point, inverse)
    return float(mapped[0][0][0]), float(mapped[0][0][1])


def project_lines(matrix: np.ndarray) -> list[tuple[str, list[tuple[float, float]]]]:
    """Every court line, drawn back into the picture.

    This is how the calibration gets checked: if these land on the real painted
    lines, the four corners were clicked correctly. If they drift, they did not.
    Letting the eye confirm it beats trusting a number.
    """
    from court.model import LINES

    projected = []
    for name, start, end in LINES:
        projected.append(
            (
                name,
                [
                    to_image(matrix, *start),
                    to_image(matrix, *end),
                ],
            )
        )
    return projected
