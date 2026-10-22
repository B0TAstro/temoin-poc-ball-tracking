/** Where the server is, and the plain HTTP calls we make to it. */

import type { VideoInfo } from './types'

export const API_BASE = 'http://localhost:8000'
export const WS_BASE = 'ws://localhost:8000'

/** The URL the <video> element plays, served by the backend with Range support. */
export function videoUrl(name: string): string {
  return `${API_BASE}/videos/${encodeURIComponent(name)}`
}

/** Everything available in `data/videos/`. */
export async function listVideos(): Promise<VideoInfo[]> {
  const response = await fetch(`${API_BASE}/api/videos`)
  if (!response.ok) throw new Error(`liste des vidéos : HTTP ${response.status}`)
  return response.json()
}

/** Send a dropped video to the server, which is where it gets decoded. */
export async function uploadVideo(file: File): Promise<VideoInfo> {
  const body = new FormData()
  body.append('file', file)

  const response = await fetch(`${API_BASE}/api/videos`, { method: 'POST', body })
  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    throw new Error(detail?.detail ?? `envoi : HTTP ${response.status}`)
  }
  return response.json()
}
