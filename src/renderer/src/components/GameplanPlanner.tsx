import { useStore, type Matchup } from '../state/store'
import { spriteStyle } from '../data/sprites'

const genId = (): string => Math.random().toString(36).slice(2, 10)

export default function GameplanPlanner(): JSX.Element {
  const { team, gameplan, setGameplan } = useStore()
  const members = team.filter((s) => s.species)

  // Functional updates so rapid clicks (before a re-render) accumulate correctly.
  const patchMatchup = (id: string, patch: Partial<Matchup>): void =>
    setGameplan((gp) => ({
      ...gp,
      matchups: gp.matchups.map((m) => (m.id === id ? { ...m, ...patch } : m))
    }))

  const mapMatchup = (id: string, fn: (m: Matchup) => Matchup): void =>
    setGameplan((gp) => ({
      ...gp,
      matchups: gp.matchups.map((m) => (m.id === id ? fn(m) : m))
    }))

  const addMatchup = (): void =>
    setGameplan((gp) => ({
      ...gp,
      matchups: [...gp.matchups, { id: genId(), label: '', picks: {}, notes: '' }]
    }))

  const removeMatchup = (id: string): void =>
    setGameplan((gp) => ({ ...gp, matchups: gp.matchups.filter((m) => m.id !== id) }))

  // Click a mon to add/remove it from the 4 brought. Removing also clears its lead.
  const toggleBring = (matchupId: string, memberId: string): void =>
    mapMatchup(matchupId, (m) => {
      const picks = { ...m.picks }
      if (picks[memberId]) delete picks[memberId]
      else if (Object.keys(picks).length < 4) picks[memberId] = 'bring'
      return { ...m, picks }
    })

  // Toggle a brought mon as one of the 2 leads.
  const toggleLead = (matchupId: string, memberId: string): void =>
    mapMatchup(matchupId, (m) => {
      if (!m.picks[memberId]) return m
      const picks = { ...m.picks }
      const leadCount = Object.values(picks).filter((v) => v === 'lead').length
      if (picks[memberId] === 'lead') picks[memberId] = 'bring'
      else if (leadCount < 2) picks[memberId] = 'lead'
      return { ...m, picks }
    })

  return (
    <div className="panel full">
      <h2>Gameplan</h2>
      <p className="subtle">
        Plan Team Preview brings and leads for your current team against common threats and
        archetypes. Tied to the team in the Teambuilder — saved automatically.
      </p>

      {members.length === 0 ? (
        <p className="subtle">Build a team in the Teambuilder first, then plan matchups here.</p>
      ) : (
        <>
          <div className="gp-team">
            {members.map((s) => (
              <span key={s.id} className="gp-team-chip" title={s.species}>
                <span className="sprite" style={spriteStyle(s.species)} />
                {s.species}
              </span>
            ))}
          </div>

          <label className="gp-notes-label">
            <span className="meta-sub">Win conditions / general plan</span>
            <textarea
              className="gp-notes"
              placeholder="Primary game plans, win conditions, things to set up…"
              value={gameplan.notes}
              onChange={(e) => setGameplan((gp) => ({ ...gp, notes: e.target.value }))}
            />
          </label>

          <div className="gp-matchups">
            {gameplan.matchups.map((m) => {
              const bring = Object.keys(m.picks).length
              const leads = members.filter((s) => m.picks[s.id] === 'lead')
              return (
                <div key={m.id} className="gp-card">
                  <div className="gp-card-head">
                    <input
                      className="gp-label"
                      placeholder="vs … (e.g. Trick Room, Miraidon, Rain)"
                      value={m.label}
                      onChange={(e) => patchMatchup(m.id, { label: e.target.value })}
                    />
                    <span className="gp-counts subtle">
                      Bring {bring}/4 · Leads {leads.length}/2
                    </span>
                    <button className="gp-del" onClick={() => removeMatchup(m.id)} title="Remove">
                      ✕
                    </button>
                  </div>

                  <div className="gp-mons">
                    {members.map((s) => {
                      const role = m.picks[s.id]
                      return (
                        <div
                          key={s.id}
                          className={role ? 'gp-mon picked' : 'gp-mon'}
                        >
                          <button className="gp-mon-btn" onClick={() => toggleBring(m.id, s.id)}>
                            <span className="sprite" style={spriteStyle(s.species)} />
                            <span className="gp-mon-name">{s.species}</span>
                          </button>
                          {role && (
                            <button
                              className={role === 'lead' ? 'gp-lead on' : 'gp-lead'}
                              onClick={() => toggleLead(m.id, s.id)}
                              title="Toggle lead"
                            >
                              {role === 'lead' ? '★ Lead' : '☆ Lead'}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {leads.length > 0 && (
                    <div className="gp-lead-summary subtle">
                      Leads: {leads.map((s) => s.species).join(' + ')}
                    </div>
                  )}

                  <textarea
                    className="gp-matchup-notes"
                    placeholder="How this matchup plays out — key threats, sequencing, what to protect / target…"
                    value={m.notes}
                    onChange={(e) => patchMatchup(m.id, { notes: e.target.value })}
                  />
                </div>
              )
            })}
          </div>

          <button className="add-btn" onClick={addMatchup}>
            + Add matchup
          </button>
        </>
      )}
    </div>
  )
}
