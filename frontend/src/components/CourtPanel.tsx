/**
 * Calibrating the court, and what the bounces say once it is calibrated.
 *
 * The wording here matters as much as the maths. Témoin never decides a point:
 * a reading always comes with its uncertainty, and when the margin is smaller
 * than that uncertainty the answer is "trop juste" — which is an answer, and an
 * honest one, not a failure.
 */

import { CORNER_LABELS } from '../lib/useCourtCalibration'
import type { LineCall } from '../lib/types'

type Props = {
  cornersPlaced: number
  calibrating: boolean
  singles: boolean
  calls: LineCall[]
  error: string | null
  currentFrame: number
  onStart: () => void
  onReset: () => void
  onSingles: (singles: boolean) => void
  onSeek: (frame: number) => void
}

const VERDICT_LABEL: Record<LineCall['verdict'], string> = {
  in: 'DEDANS',
  out: 'DEHORS',
  too_close: 'TROP JUSTE',
}

const VERDICT_STYLE: Record<LineCall['verdict'], string> = {
  in: 'text-green-300 border-green-400/40 bg-green-400/5',
  out: 'text-red-300 border-red-400/40 bg-red-400/5',
  too_close: 'text-amber-300 border-amber-400/40 bg-amber-400/5',
}

/** "sideline_left" -> "couloir gauche", for the reading pane. */
function lineLabel(name: string) {
  const labels: Record<string, string> = {
    sideline_left: 'ligne de côté gauche',
    sideline_right: 'ligne de côté droite',
    baseline_near: 'ligne de fond proche',
    baseline_far: 'ligne de fond lointaine',
  }
  return labels[name] ?? name
}

export function CourtPanel({
  cornersPlaced,
  calibrating,
  singles,
  calls,
  error,
  currentFrame,
  onStart,
  onReset,
  onSingles,
  onSeek,
}: Props) {
  const calibrated = cornersPlaced === 4

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-200">Court</h2>

      {!calibrated && !calibrating && (
        <p className="text-[11px] leading-relaxed text-slate-500">
          Clique les quatre coins extérieurs du court pour le caler. Le modèle
          du court se dessinera par-dessus : s'il tombe sur les vraies lignes,
          le calage est bon.
        </p>
      )}

      {calibrating && (
        <div className="rounded-md border border-orange-400/40 bg-orange-400/5 px-3 py-2">
          <p className="text-xs font-semibold text-orange-300">
            Coin {cornersPlaced + 1} sur 4
          </p>
          <p className="text-[11px] text-orange-200/70">
            {CORNER_LABELS[cornersPlaced]}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onStart}
          className="flex-1 rounded-md border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-200 transition-colors hover:bg-slate-700"
        >
          {calibrated ? 'Recaler' : 'Caler le court'}
        </button>
        {(calibrated || calibrating) && (
          <button
            onClick={onReset}
            className="rounded-md border border-slate-800 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:text-slate-200"
          >
            Effacer
          </button>
        )}
      </div>

      {calibrated && (
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={singles}
            onChange={(event) => onSingles(event.target.checked)}
            className="accent-lime-300"
          />
          Simple (décoche pour juger sur les couloirs)
        </label>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {calibrated && calls.length === 0 && !error && (
        <p className="text-[11px] text-slate-500">
          Aucun rebond à juger — lance d'abord une analyse.
        </p>
      )}

      {calls.map((call) => {
        const near = Math.abs(call.frame - currentFrame) < 10
        return (
          <button
            key={call.frame}
            onClick={() => onSeek(Math.round(call.frame))}
            className={`block w-full rounded-md border px-3 py-2 text-left transition-colors ${
              VERDICT_STYLE[call.verdict]
            } ${near ? 'ring-1 ring-slate-500' : ''}`}
          >
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-bold">{VERDICT_LABEL[call.verdict]}</span>
              <span className="font-mono text-[11px] opacity-70">
                {call.t.toFixed(2)} s
              </span>
            </div>
            <div className="font-mono text-[11px] opacity-80">
              {call.margin_m >= 0 ? '+' : ''}
              {call.margin_m.toFixed(2)} m ± {call.uncertainty_m.toFixed(2)}
            </div>
            <div className="text-[11px] opacity-60">
              de la {lineLabel(call.nearest_line)}
              {!call.refined && ' · position non affinée'}
            </div>
          </button>
        )
      })}

      {calibrated && calls.length > 0 && (
        <p className="text-[11px] leading-relaxed text-slate-500">
          La marge est la distance du centre de la balle à la ligne la plus
          proche. « Trop juste » veut dire que la marge est plus petite que
          l'incertitude — l'application ne tranche pas, elle le dit.
        </p>
      )}
    </section>
  )
}
