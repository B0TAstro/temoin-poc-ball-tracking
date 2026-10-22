/** The tab bar. No router: three tabs do not justify one. */

import { TABS, type Tab } from '../lib/tabs'

type Props = {
  active: Tab
  onChange: (tab: Tab) => void
}

export function TabBar({ active, onChange }: Props) {
  return (
    <nav className="flex gap-1 border-b border-slate-800">
      {TABS.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === active
              ? 'border-b-2 border-lime-300 text-lime-300'
              : 'border-b-2 border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          {tab}
        </button>
      ))}
    </nav>
  )
}
