/**
 * Onglet Replay : l'analyse d'une vidéo.
 *
 * Jalon 1 — coquille. La structure est posée (dépôt de vidéo, lecteur,
 * timeline) mais rien n'est branché.
 */

import { ComingSoon } from '../components/ComingSoon'

export function ReplayTab() {
  return (
    <div className="space-y-6">
      <ComingSoon milestone="jalon 3">
        Charger une vidéo, suivre la balle image par image et repérer les
        frappes, rebonds et fins de point sur la timeline.
      </ComingSoon>

      {/* Zone de dépôt, inerte */}
      <div className="flex h-40 items-center justify-center rounded-lg border-2 border-dashed border-slate-800 text-sm text-slate-500">
        Déposer une vidéo de point ici
      </div>

      {/* Lecteur vide */}
      <div className="flex h-64 items-center justify-center rounded-lg border border-slate-800 bg-black text-sm text-slate-600">
        Pas de vidéo chargée
      </div>

      {/* Timeline vide : la barre et ses graduations, sans événements */}
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
