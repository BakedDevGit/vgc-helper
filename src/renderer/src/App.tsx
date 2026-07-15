import { useState } from 'react'
import StatCalculator from './components/StatCalculator'
import DamageCalculator from './components/DamageCalculator'
import Teambuilder from './components/Teambuilder'
import GameplanPlanner from './components/GameplanPlanner'
import BattleData from './components/BattleData'
import LegalityGrid from './components/LegalityGrid'
import MoveDex from './components/MoveDex'
import ItemDex from './components/ItemDex'
import UpdateBanner from './components/UpdateBanner'
import { StoreProvider } from './state/store'
import ErrorBoundary from './components/ErrorBoundary'

type Tab = 'stats' | 'damage' | 'team' | 'gameplan' | 'battle' | 'legal' | 'moves' | 'items'

const TABS: { id: Tab; label: string }[] = [
  { id: 'stats', label: 'Stat Calc' },
  { id: 'damage', label: 'Damage Calc' },
  { id: 'team', label: 'Teambuilder' },
  { id: 'gameplan', label: 'Gameplan' },
  { id: 'battle', label: 'Battle Data' },
  { id: 'legal', label: 'Legality' },
  { id: 'moves', label: 'Moves' },
  { id: 'items', label: 'Items' }
]

export default function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>('stats')

  return (
    <StoreProvider>
      <div className="app">
        <header className="topbar">
          <div className="brand">
            VGC <span>Helper</span>
          </div>
          <nav className="tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={tab === t.id ? 'tab active' : 'tab'}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <UpdateBanner />
        </header>

        <main className="content">
          <ErrorBoundary>
            {tab === 'stats' && <StatCalculator />}
            {tab === 'damage' && <DamageCalculator />}
            {tab === 'team' && <Teambuilder />}
            {tab === 'gameplan' && <GameplanPlanner />}
            {tab === 'battle' && <BattleData />}
            {tab === 'legal' && <LegalityGrid />}
            {tab === 'moves' && <MoveDex />}
            {tab === 'items' && <ItemDex />}
          </ErrorBoundary>
        </main>
      </div>
    </StoreProvider>
  )
}
