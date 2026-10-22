/**
 * Choosing what to analyse: one of the videos already on the server, or one
 * dropped here.
 *
 * A dropped file is uploaded, because the server is where OpenCV decodes it
 * frame by frame. Once uploaded it joins the list like any other.
 */

import { useState } from 'react'

import type { VideoInfo } from '../lib/types'

type Props = {
  videos: VideoInfo[]
  selected: string | null
  busy: boolean
  onSelect: (name: string) => void
  onDrop: (file: File) => void
}

function formatSize(bytes: number) {
  return `${(bytes / 1e6).toFixed(1)} Mo`
}

export function VideoPicker({ videos, selected, busy, onSelect, onDrop }: Props) {
  const [dragging, setDragging] = useState(false)

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files[0]
    if (file) onDrop(file)
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex h-24 items-center justify-center rounded-lg border-2 border-dashed text-sm transition-colors ${
          dragging
            ? 'border-lime-300 bg-lime-300/5 text-lime-300'
            : 'border-slate-800 text-slate-500'
        }`}
      >
        {busy ? 'envoi en cours…' : 'Déposer une vidéo de point ici'}
      </div>

      {videos.length === 0 ? (
        <p className="text-xs text-slate-500">
          Aucune vidéo sur le serveur. Dépose-en une, ou lance
          <code className="mx-1 rounded bg-slate-800 px-1">
            python scripts/fetch_sample_videos.py
          </code>
          pour récupérer trois clips de test.
        </p>
      ) : (
        <ul className="space-y-1">
          {videos.map((video) => (
            <li key={video.name}>
              <button
                onClick={() => onSelect(video.name)}
                className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                  video.name === selected
                    ? 'border-lime-300/60 bg-lime-300/5'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="truncate text-sm text-slate-200">{video.name}</div>
                <div className="font-mono text-[11px] text-slate-500">
                  {video.width}×{video.height} · {video.fps.toFixed(0)} im/s ·{' '}
                  {video.frames} images · {video.duration_s.toFixed(1)} s ·{' '}
                  {formatSize(video.size_bytes)}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
