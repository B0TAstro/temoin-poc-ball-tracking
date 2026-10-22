/**
 * Replay tab: analysing a video.
 *
 * Pick or drop a video, run the detector over every frame, then replay it in
 * slow motion with the trajectory drawn on top, a timeline showing where the
 * ball was really found, and the bounces and hits read off the path.
 *
 * What is still missing to answer "in or out": the court lines and the
 * homography that projects a bounce onto the real court. That is milestone 5.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

import { AnalysisSettings } from '../components/AnalysisSettings'
import { ComingSoon } from '../components/ComingSoon'
import { EventList } from '../components/EventList'
import { TrackTimeline } from '../components/TrackTimeline'
import { VideoPicker } from '../components/VideoPicker'
import { VideoPlayer } from '../components/VideoPlayer'
import { listVideos, uploadVideo, videoUrl } from '../lib/api'
import type { Timeline, VideoInfo } from '../lib/types'
import { useReplayPlayer } from '../lib/useReplayPlayer'
import { useVideoAnalysis } from '../lib/useVideoAnalysis'

export function ReplayTab() {
  const [videos, setVideos] = useState<VideoInfo[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [detector, setDetector] = useState('yolo11s')
  const [imgsz, setImgsz] = useState(1920)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { state, analyze } = useVideoAnalysis()

  // Only show a trajectory that belongs to the video on screen.
  const timeline: Timeline | null = useMemo(() => {
    if (state.phase !== 'done') return null
    return state.result.timeline.video === selected ? state.result.timeline : null
  }, [state, selected])

  const player = useReplayPlayer({ timeline })

  const refresh = useCallback(async () => {
    try {
      const found = await listVideos()
      setVideos(found)
      setSelected((current) => current ?? found[0]?.name ?? null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }
  }, [])

  // Loading the list on mount is exactly what an effect is for: the state is
  // set after the await, not during the render.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh()
  }, [refresh])

  const handleDrop = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const uploaded = await uploadVideo(file)
      await refresh()
      setSelected(uploaded.name)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setUploading(false)
    }
  }

  const running = state.phase === 'running'
  const selectedInfo = videos.find((video) => video.name === selected)

  // While analysing we know the total from the file, which is more reliable
  // than what the progress messages report.
  const progressTotal =
    running && state.total > 0 ? state.total : (selectedInfo?.frames ?? 0)
  const progressPercent =
    running && progressTotal > 0 ? (state.frame / progressTotal) * 100 : 0

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="space-y-5">
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-200">Vidéo</h2>
          <VideoPicker
            videos={videos}
            selected={selected}
            busy={uploading}
            onSelect={(name) => {
              setSelected(name)
              player.reset()
            }}
            onDrop={handleDrop}
          />
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-200">Analyse</h2>
          <AnalysisSettings
            detector={detector}
            imgsz={imgsz}
            disabled={running}
            onDetector={setDetector}
            onImgsz={setImgsz}
          />
          <button
            disabled={!selected || running}
            onClick={() => {
              player.reset()
              analyze({ video: selected!, detector, imgsz })
            }}
            className="w-full rounded-md bg-lime-300 px-4 py-2 text-sm font-medium text-slate-950 transition-colors hover:bg-lime-200 disabled:bg-slate-800 disabled:text-slate-500"
          >
            {running ? 'Analyse en cours…' : 'Analyser'}
          </button>

          {running && (
            <div className="space-y-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-lime-300 transition-[width]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="font-mono text-[11px] text-slate-500">
                image {state.frame}
                {progressTotal > 0 && ` / ${progressTotal}`}
              </p>
            </div>
          )}

          {state.phase === 'error' && (
            <p className="text-xs text-red-400">{state.message}</p>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </section>

        {state.phase === 'done' && (
          <section className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <h2 className="text-sm font-semibold text-slate-200">Résultat</h2>
            <dl className="space-y-1 text-xs">
              {[
                ['Modèle', `${state.result.detector} @ ${state.result.imgsz} px`],
                [
                  'Candidats proposés',
                  `${state.result.frames_with_candidate} / ${state.result.frames_read}`,
                ],
                [
                  'Retenus comme balle',
                  `${state.result.frames_with_ball} (${((100 * state.result.frames_with_ball) / Math.max(state.result.frames_read, 1)).toFixed(0)} %)`,
                ],
                ['Interpolés', `${state.result.frames_interpolated}`],
                ['Runs', `${state.result.segments}`],
                ['Durée', `${state.result.elapsed_s} s`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-slate-400">{label}</dt>
                  <dd className="font-mono text-slate-100">{value}</dd>
                </div>
              ))}
            </dl>

            {state.result.rejected_static.length > 0 && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1.5">
                <p className="text-[11px] font-semibold text-amber-200/90">
                  Rejeté car immobile
                </p>
                {state.result.rejected_static.map((object) => (
                  <p
                    key={`${object.x}-${object.y}`}
                    className="font-mono text-[11px] text-amber-200/60"
                  >
                    ({object.x.toFixed(0)}, {object.y.toFixed(0)}) — {object.frames}{' '}
                    images
                  </p>
                ))}
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  Une balle ne reste jamais immobile. Sur les clips de test,
                  c'est un panneau publicitaire jaune que le modèle prenait pour
                  une balle sur 100 % des images.
                </p>
              </div>
            )}

            <p className="pt-1 text-[11px] leading-relaxed text-slate-500">
              « Candidats proposés » est le chiffre flatteur, « retenus comme
              balle » l'honnête. Regarde quand même la trajectoire : c'est le
              seul juge.
            </p>
          </section>
        )}

        {timeline && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-200">Événements</h2>
            <EventList
              events={timeline.events}
              currentFrame={player.currentFrame}
              onSeek={player.seekToFrame}
            />
          </section>
        )}

      </aside>

      <section className="space-y-4">
        <VideoPlayer
          src={selected ? videoUrl(selected) : null}
          videoRef={player.videoRef}
          overlayRef={player.overlayRef}
          isPlaying={player.isPlaying}
          speed={player.speed}
          currentFrame={player.currentFrame}
          totalFrames={player.totalFrames || (selectedInfo?.frames ?? 0)}
          fps={player.fps}
          onPlay={player.play}
          onPause={player.pause}
          onStep={player.step}
          onSpeed={player.setSpeed}
          onLoaded={player.reset}
        />

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-slate-300">Timeline</h3>
            <span className="text-[11px] text-slate-500">
              clair = balle détectée · pâle = interpolé ·{' '}
              <span className="text-rose-400">rebond</span> ·{' '}
              <span className="text-amber-300">frappe</span> ·{' '}
              <span className="text-indigo-300">fin</span> · clic pour se déplacer
            </span>
          </div>
          <TrackTimeline
            track={player.track}
            events={timeline?.events ?? []}
            totalFrames={player.totalFrames || (selectedInfo?.frames ?? 0)}
            currentFrame={player.currentFrame}
            onSeek={player.seekToFrame}
          />
          <ComingSoon milestone="jalon 5">
            Les lignes du court et l'homographie, pour projeter un rebond sur le
            plan du court et enfin répondre « dedans ou dehors ».
          </ComingSoon>
        </div>
      </section>
    </div>
  )
}
