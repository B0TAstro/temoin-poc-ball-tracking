/**
 * Training tab: model training.
 *
 * Milestone 1 — a shell. The settings are shown but disabled: there is no
 * dataset and no Ultralytics installed.
 */

import { ComingSoon } from '../components/ComingSoon'

/** The main settings listed in CLAUDE.md. */
const SETTINGS = [
  { label: 'Modèle de départ', value: 'yolo11n.pt' },
  { label: "Nombre d'époques", value: '50' },
  { label: "Taille d'image", value: '640' },
]

export function TrainingTab() {
  return (
    <div className="space-y-6">
      <ComingSoon milestone="jalon 4">
        Charger un export Roboflow au format YOLO, lancer un fine-tuning et
        comparer les modèles obtenus.
      </ComingSoon>

      <div className="grid gap-4 sm:grid-cols-3">
        {SETTINGS.map((setting) => (
          <label key={setting.label} className="block space-y-1">
            <span className="text-xs text-slate-400">{setting.label}</span>
            <input
              disabled
              value={setting.value}
              readOnly
              className="w-full rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 font-mono text-sm text-slate-500"
            />
          </label>
        ))}
      </div>

      <button
        disabled
        className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-slate-500"
      >
        Lancer l'entraînement
      </button>

      {/* Where the training curves will go */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-300">
          Courbes d'entraînement
        </h3>
        <div className="flex h-48 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/60 text-sm text-slate-600">
          pertes, précision, rappel, mAP
        </div>
      </div>
    </div>
  )
}
