/**
 * The events found in the trajectory, as a list you can jump from.
 *
 * Confidence here is a reading aid, never a verdict: the application never
 * decides a point, it shows what it saw and lets the players decide.
 */

import type { Event } from '../lib/types'

type Props = {
  events: Event[]
  currentFrame: number
  onSeek: (frame: number) => void
}

const LABELS: Record<Event['type'], string> = {
  bounce: 'rebond',
  hit: 'frappe',
  point_end: 'fin du point',
}

const DOT_COLORS: Record<Event['type'], string> = {
  bounce: 'bg-rose-400',
  hit: 'bg-amber-300',
  point_end: 'bg-indigo-300',
}

export function EventList({ events, currentFrame, onSeek }: Props) {
  if (events.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        Aucun événement — il faut d'abord une trajectoire à analyser.
      </p>
    )
  }

  return (
    <ul className="space-y-1">
      {events.map((event) => {
        const near = Math.abs(event.frame - currentFrame) < 4
        return (
          <li key={`${event.type}-${event.frame}`}>
            <button
              onClick={() => onSeek(event.frame)}
              className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors ${
                near
                  ? 'border-slate-600 bg-slate-800/60'
                  : 'border-transparent hover:border-slate-800'
              }`}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${DOT_COLORS[event.type]}`}
              />
              <span className="text-xs text-slate-200">{LABELS[event.type]}</span>
              <span className="ml-auto font-mono text-[11px] text-slate-500">
                {event.t.toFixed(2)} s · {event.conf.toFixed(2)}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
