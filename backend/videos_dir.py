"""Where test videos live, and how to look one up safely."""

from pathlib import Path

import cv2

from schemas import VideoInfo

#: `data/videos/` at the repository root. Git-ignored, see CLAUDE.md.
VIDEOS_DIR = Path(__file__).resolve().parent.parent / "data" / "videos"

#: What the Replay tab accepts, both preloaded and dropped.
ALLOWED_SUFFIXES = {".mp4", ".mov", ".m4v", ".avi", ".mkv", ".webm"}


def resolve(name: str) -> Path:
    """Turn a video name coming from the browser into a real path.

    `Path(name).name` drops any directory part, so "../../etc/passwd" becomes
    "passwd" and cannot escape the folder. We then check the result really is
    inside VIDEOS_DIR before touching it.
    """
    safe = Path(name).name
    if not safe or Path(safe).suffix.lower() not in ALLOWED_SUFFIXES:
        raise ValueError(f"not a video file name: {name!r}")

    path = (VIDEOS_DIR / safe).resolve()
    if not path.is_relative_to(VIDEOS_DIR.resolve()):
        raise ValueError(f"outside the videos folder: {name!r}")
    if not path.is_file():
        raise FileNotFoundError(f"no such video: {safe}")
    return path


def describe(path: Path) -> VideoInfo:
    """Read a video's shape without decoding any of it."""
    capture = cv2.VideoCapture(str(path))
    try:
        fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
        frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        return VideoInfo(
            name=path.name,
            size_bytes=path.stat().st_size,
            fps=round(fps, 3),
            frames=frames,
            width=int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0),
            height=int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0),
            duration_s=round(frames / fps, 2) if fps else 0.0,
        )
    finally:
        capture.release()


def listing() -> list[VideoInfo]:
    """Every usable video in the folder, newest-looking name last."""
    VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
    found = [
        path
        for path in VIDEOS_DIR.iterdir()
        if path.is_file()
        and not path.name.startswith(".")
        and path.suffix.lower() in ALLOWED_SUFFIXES
    ]
    return [describe(path) for path in sorted(found)]
