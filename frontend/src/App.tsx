/** The application shell: a header and the three tabs. */

import { useState } from 'react'

import { TabBar } from './components/TabBar'
import type { Tab } from './lib/tabs'
import { CameraTab } from './tabs/CameraTab'
import { ReplayTab } from './tabs/ReplayTab'
import { TrainingTab } from './tabs/TrainingTab'

export default function App() {
  const [tab, setTab] = useState<Tab>('Camera')

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-lg font-semibold text-slate-100">
          Témoin — suivi de balle
        </h1>
        <p className="text-xs text-slate-500">
          POC d'exploration · jalon 1 : la plomberie, avec une fausse détection
        </p>
      </header>

      <TabBar active={tab} onChange={setTab} />

      <main className="pt-6">
        {tab === 'Camera' && <CameraTab />}
        {tab === 'Replay' && <ReplayTab />}
        {tab === 'Training' && <TrainingTab />}
      </main>
    </div>
  )
}
