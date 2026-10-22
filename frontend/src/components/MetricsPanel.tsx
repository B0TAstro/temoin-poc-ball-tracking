/**
 * Le panneau de performances de l'onglet Camera.
 *
 * C'est le résultat du jalon 1 : la latence de l'aller-retour. À 15 images par
 * seconde on dispose de 66 ms par image, donc on surligne en rouge au-delà.
 */

import type { Metrics, SocketStatus } from '../lib/types'

type Props = {
  metrics: Metrics
  status: SocketStatus
  targetFps: number
}

/** Le budget par image, en ms, pour la cadence visée. */
function budgetMs(targetFps: number) {
  return 1000 / targetFps
}

function Row({
  label,
  value,
  hint,
  warn = false,
}: {
  label: string
  value: string
  hint?: string
  warn?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-slate-800/60 py-1.5 last:border-0">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-right">
        <span
          className={`font-mono text-sm ${warn ? 'text-red-400' : 'text-slate-100'}`}
        >
          {value}
        </span>
        {hint && <span className="ml-2 text-[10px] text-slate-500">{hint}</span>}
      </span>
    </div>
  )
}

export function MetricsPanel({ metrics, status, targetFps }: Props) {
  const budget = budgetMs(targetFps)
  const missRate =
    metrics.totalFrames > 0
      ? (metrics.missedFrames / metrics.totalFrames) * 100
      : 0

  const statusLabel: Record<SocketStatus, string> = {
    connecting: 'connexion…',
    open: 'connecté',
    closed: 'déconnecté',
  }
  const statusColor: Record<SocketStatus, string> = {
    connecting: 'text-amber-300',
    open: 'text-lime-300',
    closed: 'text-red-400',
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Performances</h2>
        <span className={`text-xs font-medium ${statusColor[status]}`}>
          ● {statusLabel[status]}
        </span>
      </div>

      <Row
        label="Images capturées"
        value={`${metrics.capturedFps.toFixed(1)} /s`}
        hint={`cible ${targetFps}`}
      />
      <Row
        label="Images traitées"
        value={`${metrics.processedFps.toFixed(1)} /s`}
      />
      <Row
        label="Aller-retour"
        value={`${metrics.roundTripMs.toFixed(1)} ms`}
        hint={`budget ${budget.toFixed(0)}`}
        warn={metrics.roundTripMs > budget}
      />
      <Row
        label="Temps serveur"
        value={`${metrics.inferenceMs.toFixed(2)} ms`}
        hint="fausse détection"
      />
      <Row
        label="Confiance"
        value={metrics.lastConf === null ? '—' : metrics.lastConf.toFixed(2)}
        hint={metrics.lastConf === null ? 'balle non vue' : undefined}
      />
      <Row
        label="Images sans balle"
        value={`${metrics.missedFrames} / ${metrics.totalFrames}`}
        hint={`${missRate.toFixed(0)} %`}
      />

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Le serveur ne décode pas encore l'image et ne charge aucun modèle :
        l'aller-retour ci-dessus est le plancher. Le jalon 2 dira ce que le
        décodage et l'inférence ajoutent par-dessus.
      </p>
    </div>
  )
}
