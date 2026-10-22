/**
 * The replay player: the video with the trajectory drawn over it, plus the
 * controls to walk through it frame by frame.
 *
 * No logic here — everything comes from `useReplayPlayer`.
 */

import type { RefObject } from 'react'

import { SPEEDS } from '../lib/useReplayPlayer'

type Props = {
  src: string | null
  videoRef: RefObject<HTMLVideoElement | null>
  overlayRef: RefObject<HTMLCanvasElement | null>
  isPlaying: boolean
  speed: number
  currentFrame: number
  totalFrames: number
  fps: number
  onPlay: () => void
  onPause: () => void
  onStep: (delta: number) => void
  onSpeed: (speed: number) => void
  onLoaded: () => void
}

function Button({
  onClick,
  children,
  title,
}: {
  onClick: () => void
  children: React.ReactNode
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="rounded-md border border-slate-700 bg-slate-800/60 px-3 py-1.5 font-mono text-sm text-slate-200 transition-colors hover:bg-slate-700"
    >
      {children}
    </button>
  )
}

export function VideoPlayer({
  src,
  videoRef,
  overlayRef,
  isPlaying,
  speed,
  currentFrame,
  totalFrames,
  fps,
  onPlay,
  onPause,
  onStep,
  onSpeed,
  onLoaded,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-lg border border-slate-800 bg-black">
        {src ? (
          <video
            ref={videoRef}
            src={src}
            playsInline
            muted
            onLoadedMetadata={onLoaded}
            className="block w-full"
          />
        ) : (
          <div className="flex h-64 items-center justify-center text-sm text-slate-600">
            Aucune vidéo chargée
          </div>
        )}
        <canvas
          ref={overlayRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={isPlaying ? onPause : onPlay}>
          {isPlaying ? '❚❚' : '▶'}
        </Button>
        <Button onClick={() => onStep(-1)} title="Image précédente">
          ◀ 1
        </Button>
        <Button onClick={() => onStep(1)} title="Image suivante">
          1 ▶
        </Button>

        <span className="ml-2 font-mono text-xs text-slate-400">
          image {currentFrame} / {Math.max(totalFrames - 1, 0)}
          <span className="ml-2 text-slate-600">
            {(currentFrame / (fps || 1)).toFixed(2)} s
          </span>
        </span>

        <div className="ml-auto flex items-center gap-1">
          <span className="mr-1 text-xs text-slate-500">vitesse</span>
          {SPEEDS.map((value) => (
            <button
              key={value}
              onClick={() => onSpeed(value)}
              className={`rounded px-2 py-1 font-mono text-xs transition-colors ${
                value === speed
                  ? 'bg-lime-300 text-slate-950'
                  : 'border border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {value}×
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
