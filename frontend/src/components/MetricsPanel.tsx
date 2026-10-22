/**
 * The performance panel of the Camera tab.
 *
 * Server time is split in two — decoding the JPEG and running the model — so
 * it can be compared with the milestone 1 baseline, where the server did
 * neither and the round trip was about 0.3 ms.
 *
 * At 15 frames per second we have 66 ms per frame, so anything above that is
 * flagged in red.
 */

import type { Metrics, SocketStatus } from '../lib/types'

type Props = {
  metrics: Metrics
  status: SocketStatus
  targetFps: number
}

/** The per-frame budget, in ms, for the target frame rate. */
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
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Performances</h2>
        <span className={`text-xs font-medium ${statusColor[status]}`}>
          ● {statusLabel[status]}
        </span>
      </div>
      <p className="mb-2 text-[11px] text-slate-500">
        Détecteur :{' '}
        <code className="rounded bg-slate-800 px-1 font-mono text-lime-300">
          {metrics.detector}
        </code>
      </p>

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
        label="dont décodage image"
        value={`${metrics.decodeMs.toFixed(2)} ms`}
      />
      <Row
        label="dont inférence"
        value={`${metrics.inferenceMs.toFixed(1)} ms`}
        warn={metrics.inferenceMs > budget}
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
        « Images sans balle » compte les images où le modèle n'a rien vu. Avec un
        YOLO non ré-entraîné, c'est le chiffre qui dit s'il faut passer au
        fine-tuning ou à TrackNet.
      </p>
    </div>
  )
}
