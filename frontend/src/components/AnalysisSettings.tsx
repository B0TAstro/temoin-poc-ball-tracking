/**
 * The two settings that decide what the analysis is worth.
 *
 * Measured on a broadcast clip (929 frames, 1920x1080): yolo11n at 1920 found
 * the ball on 17% of frames, yolo11s at 1920 on 100%. At 640 nothing was found
 * at all. So these are not cosmetic knobs.
 */

type Props = {
  detector: string
  imgsz: number
  disabled: boolean
  onDetector: (value: string) => void
  onImgsz: (value: number) => void
}

const DETECTORS = [
  { value: 'yolo11n', label: 'yolo11n — le plus rapide' },
  { value: 'yolo11s', label: 'yolo11s — le meilleur compromis' },
  { value: 'yolo11m', label: 'yolo11m — plus gros, pas forcément mieux' },
  { value: 'fake', label: 'fake — fausse détection, pour comparer' },
]

const SIZES = [640, 960, 1280, 1920]

export function AnalysisSettings({
  detector,
  imgsz,
  disabled,
  onDetector,
  onImgsz,
}: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block space-y-1">
        <span className="text-xs text-slate-400">Modèle</span>
        <select
          value={detector}
          disabled={disabled}
          onChange={(event) => onDetector(event.target.value)}
          className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 disabled:text-slate-600"
        >
          {DETECTORS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-slate-400">
          Résolution d'analyse{' '}
          <span className="text-slate-600">— le réglage qui compte</span>
        </span>
        <select
          value={imgsz}
          disabled={disabled}
          onChange={(event) => onImgsz(Number(event.target.value))}
          className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-200 disabled:text-slate-600"
        >
          {SIZES.map((size) => (
            <option key={size} value={size}>
              {size} px
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
