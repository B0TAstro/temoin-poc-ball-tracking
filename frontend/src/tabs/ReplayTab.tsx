/**
 * Replay tab: video analysis.
 *
 * Milestone 1 — a shell. The structure is in place (video drop zone, player,
 * timeline) but nothing is wired up.
 */

import { ComingSoon } from '../components/ComingSoon'

export function ReplayTab() {
  return (
    <div className="space-y-6">
      <ComingSoon milestone="jalon 3">
        Charger une vidéo, suivre la balle image par image et repérer les
        frappes, rebonds et fins de point sur la timeline.
      </ComingSoon>

      {/* Drop zone, inert */}
      <div className="flex h-40 items-center justify-center rounded-lg border-2 border-dashed border-slate-800 text-sm text-slate-500">
        Déposer une vidéo de point ici
      </div>

      {/* Empty player */}
      <div className="flex h-64 items-center justify-center rounded-lg border border-slate-800 bg-black text-sm text-slate-600">
        Pas de vidéo chargée
      </div>

      {/* Empty timeline: the bar and its ticks, with no events */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-300">Timeline</h3>
        <div className="relative h-10 rounded-md border border-slate-800 bg-slate-900/60">
          {[0, 25, 50, 75, 100].map((percent) => (
            <span
              key={percent}
              className="absolute top-0 h-full w-px bg-slate-800"
              style={{ left: `${percent}%` }}
            />
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Aucun événement — il n'y a pas encore de vidéo de test dans
          <code className="mx-1 rounded bg-slate-800 px-1">data/videos/</code>.
        </p>
      </div>
    </div>
  )
}
