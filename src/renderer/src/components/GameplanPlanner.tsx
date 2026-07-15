import { useStore, useLegalSpeciesNames, type Matchup } from '../state/store'
import { spriteStyle } from '../data/sprites'
import { predictMatchup, analyzeMatchup, type Role } from '../data/predict'
import SearchSelect from './SearchSelect'

const genId = (): string => Math.random().toString(36).slice(2, 10)

type Picks = Record<string, Role>

// Add/remove a key from the 4 brought (removing also clears its lead).
function toggleBringMap(picks: Picks, key: string): Picks {
  const p = { ...picks }
  if (p[key]) delete p[key]
  else if (Object.keys(p).length < 4) p[key] = 'bring'
  return p
}
// Toggle a brought key as one of the 2 leads.
function toggleLeadMap(picks: Picks, key: string): Picks {
  if (!picks[key]) return picks
  const p = { ...picks }
  const leads = Object.values(p).filter((v) => v === 'lead').length
  if (p[key] === 'lead') p[key] = 'bring'
  else if (leads < 2) p[key] = 'lead'
  return p
}

function PickChip({
  species,
  role,
  onBring,
  onLead,
  onRemove
}: {
  species: string
  role?: Role
  onBring: () => void
  onLead: () => void
  onRemove?: () => void
}): JSX.Element {
  return (
    <div className={role ? 'gp-mon picked' : 'gp-mon'}>
      {onRemove && (
        <button className="gp-remove" onClick={onRemove} title="Remove from scout">
          ✕
        </button>
      )}
      <button className="gp-mon-btn" onClick={onBring} title="Toggle bring">
        <span className="sprite" style={spriteStyle(species)} />
        <span className="gp-mon-name">{species}</span>
      </button>
      {role && (
        <button
          className={role === 'lead' ? 'gp-lead on' : 'gp-lead'}
          onClick={onLead}
          title="Toggle lead"
        >
          {role === 'lead' ? '★ Lead' : '☆ Lead'}
        </button>
      )}
    </div>
  )
}

export default function GameplanPlanner(): JSX.Element {
  const { team, gameplan, setGameplan, meta } = useStore()
  const speciesNames = useLegalSpeciesNames()
  const members = team.filter((s) => s.species)

  const mapMatchup = (id: string, fn: (m: Matchup) => Matchup): void =>
    setGameplan((gp) => ({
      ...gp,
      matchups: gp.matchups.map((m) => (m.id === id ? fn(m) : m))
    }))

  const addMatchup = (): void =>
    setGameplan((gp) => ({
      ...gp,
      matchups: [
        ...gp.matchups,
        { id: genId(), label: '', opponents: [], oppPicks: {}, picks: {}, notes: '' }
      ]
    }))

  const removeMatchup = (id: string): void =>
    setGameplan((gp) => ({ ...gp, matchups: gp.matchups.filter((m) => m.id !== id) }))

  const addOpponent = (id: string, sp: string): void =>
    mapMatchup(id, (m) => {
      const opps = m.opponents ?? []
      if (!sp || opps.includes(sp) || opps.length >= 6) return m
      return { ...m, opponents: [...opps, sp] }
    })

  const removeOpponent = (id: string, sp: string): void =>
    mapMatchup(id, (m) => {
      const oppPicks = { ...(m.oppPicks ?? {}) }
      delete oppPicks[sp]
      return { ...m, opponents: (m.opponents ?? []).filter((o) => o !== sp), oppPicks }
    })

  const predict = (id: string): void =>
    mapMatchup(id, (m) => {
      const { oppPicks, userPicks } = predictMatchup(team, m.opponents ?? [])
      return { ...m, oppPicks, picks: userPicks }
    })

  return (
    <div className="panel full">
      <h2>Gameplan</h2>
      <p className="subtle">
        Plan Team Preview for your current team. Scout an opponent, predict their likely brings and
        leads, and auto-fill a suggested counter you can refine. Saved automatically.
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
              const opponents = m.opponents ?? []
              const oppPicks = m.oppPicks ?? {}
              const myLeads = members.filter((s) => m.picks[s.id] === 'lead')
              const theirBring = opponents.filter((o) => oppPicks[o])
              const notes = analyzeMatchup(team, opponents, meta)
              return (
                <div key={m.id} className="gp-card">
                  <div className="gp-card-head">
                    <input
                      className="gp-label"
                      placeholder="vs … (e.g. Trick Room, Miraidon, Rain)"
                      value={m.label}
                      onChange={(e) => mapMatchup(m.id, (x) => ({ ...x, label: e.target.value }))}
                    />
                    <button className="gp-del" onClick={() => removeMatchup(m.id)} title="Remove">
                      ✕
                    </button>
                  </div>

                  {/* Opponent side */}
                  <div className="gp-section">
                    <div className="gp-section-head">
                      <span className="meta-sub">
                        Opponent&apos;s team {opponents.length > 0 && `(${opponents.length}/6)`}
                      </span>
                      {opponents.length < 6 && (
                        <div className="gp-add-opp">
                          <SearchSelect
                            value=""
                            onChange={(v) => addOpponent(m.id, v)}
                            options={speciesNames}
                            placeholder="+ scout a Pokémon…"
                          />
                        </div>
                      )}
                    </div>
                    {opponents.length === 0 ? (
                      <p className="subtle gp-hint">
                        Add the opponent&apos;s Pokémon to predict their picks.
                      </p>
                    ) : (
                      <>
                        <div className="gp-mons">
                          {opponents.map((o) => (
                            <PickChip
                              key={o}
                              species={o}
                              role={oppPicks[o]}
                              onBring={() =>
                                mapMatchup(m.id, (x) => ({
                                  ...x,
                                  oppPicks: toggleBringMap(x.oppPicks ?? {}, o)
                                }))
                              }
                              onLead={() =>
                                mapMatchup(m.id, (x) => ({
                                  ...x,
                                  oppPicks: toggleLeadMap(x.oppPicks ?? {}, o)
                                }))
                              }
                              onRemove={() => removeOpponent(m.id, o)}
                            />
                          ))}
                        </div>
                        <div className="gp-predict-row">
                          <button className="add-btn" onClick={() => predict(m.id)}>
                            Predict their picks &amp; my counter
                          </button>
                          {theirBring.length > 0 && (
                            <span className="subtle">
                              Predicted bring: {theirBring.join(', ')}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Ability interaction watch-outs */}
                  {notes.length > 0 && (
                    <div className="gp-warnings">
                      {notes.map((n, i) => (
                        <div key={i} className="gp-warn">
                          ⚠ {n.text}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Your side */}
                  <div className="gp-section">
                    <span className="meta-sub">
                      Your response — Bring {Object.keys(m.picks).length}/4 · Leads {myLeads.length}/2
                    </span>
                    <div className="gp-mons">
                      {members.map((s) => (
                        <PickChip
                          key={s.id}
                          species={s.species}
                          role={m.picks[s.id]}
                          onBring={() =>
                            mapMatchup(m.id, (x) => ({
                              ...x,
                              picks: toggleBringMap(x.picks, s.id)
                            }))
                          }
                          onLead={() =>
                            mapMatchup(m.id, (x) => ({
                              ...x,
                              picks: toggleLeadMap(x.picks, s.id)
                            }))
                          }
                        />
                      ))}
                    </div>
                    {myLeads.length > 0 && (
                      <div className="gp-lead-summary subtle">
                        Your leads: {myLeads.map((s) => s.species).join(' + ')}
                      </div>
                    )}
                  </div>

                  <textarea
                    className="gp-matchup-notes"
                    placeholder="How this matchup plays out — key threats, sequencing, what to protect / target…"
                    value={m.notes}
                    onChange={(e) => mapMatchup(m.id, (x) => ({ ...x, notes: e.target.value }))}
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
