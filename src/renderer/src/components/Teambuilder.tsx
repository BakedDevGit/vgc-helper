import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { findSpecies } from '../data/gen'
import { resolveSpecies } from '../data/battleApi'
import { newSet } from '../data/champions'
import { teamToPokepaste, pokepasteToTeam, normalizeTeam } from '../data/pokepaste'
import { clipboardWrite, clipboardRead, saveTextFile, openTextFile } from '../data/platform'
import PokeSetEditor from './PokeSetEditor'
import TeamTypeChart from './TeamTypeChart'

export default function Teambuilder(): JSX.Element {
  const {
    ready,
    team,
    meta,
    updateSet,
    updateTeam,
    savedTeams,
    saveTeamAs,
    overwriteSavedTeam,
    loadSavedTeam,
    deleteSavedTeam
  } = useStore()
  const [loadedId, setLoadedId] = useState('')
  const [teamName, setTeamName] = useState('')
  const [ioMsg, setIoMsg] = useState('')

  const teamSpecies = team.map((s) => s.species).filter(Boolean)

  // Aggregate recommended teammates from the meta data of mons already on the team,
  // weighting earlier (more common) teammates higher.
  const recommendations = useMemo(() => {
    const score = new Map<string, number>()
    for (const sp of teamSpecies) {
      const mates = meta[sp]?.teammates ?? []
      mates.forEach((raw, i) => {
        const mate = resolveSpecies(raw) ?? raw // normalize old "Basculegion Male" → "Basculegion"
        if (!mate || teamSpecies.includes(mate)) return
        score.set(mate, (score.get(mate) ?? 0) + (mates.length - i))
      })
    }
    return [...score.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name).slice(0, 15)
  }, [teamSpecies.join(','), meta])

  if (!ready) return <div className="panel">Loading…</div>

  function addToTeam(species: string): void {
    const slot = team.find((s) => !s.species)
    if (!slot) return
    const sp = findSpecies(species)
    updateSet('team', {
      ...slot,
      species,
      ability: sp?.abilities[0] ?? '',
      ...(sp?.isMega && sp.requiredItem ? { item: sp.requiredItem } : {})
    })
  }

  // When a saved team is selected, edits to the working team flow back into it.
  useEffect(() => {
    if (loadedId) overwriteSavedTeam(loadedId)
  }, [team, loadedId, overwriteSavedTeam])

  function handleLoad(id: string): void {
    setLoadedId(id)
    if (id) loadSavedTeam(id)
  }
  function handleSave(): void {
    const id = saveTeamAs(teamName)
    setLoadedId(id)
    setTeamName('')
  }
  function handleNewTeam(): void {
    updateTeam(Array.from({ length: 6 }, () => newSet()))
    setLoadedId('')
    setTeamName('')
  }

  function applyImport(text: string | null): void {
    if (text == null) return
    const sets = pokepasteToTeam(text)
    if (sets.length === 0) {
      setIoMsg('No Pokémon found in that text.')
      return
    }
    updateTeam(normalizeTeam(sets))
    setLoadedId('')
    setIoMsg(`Imported ${sets.length} Pokémon.`)
  }
  function copyPaste(): void {
    void clipboardWrite(teamToPokepaste(team))
    setIoMsg('Copied PokePaste to clipboard.')
  }
  async function importClipboard(): Promise<void> {
    applyImport(await clipboardRead())
  }
  async function exportFile(): Promise<void> {
    const ok = await saveTextFile('team.txt', teamToPokepaste(team))
    if (ok) setIoMsg('Saved team to file.')
  }
  async function importFile(): Promise<void> {
    applyImport(await openTextFile())
  }

  const loadedName = savedTeams.find((t) => t.id === loadedId)?.name

  return (
    <div className="panel full">
      <h2>Teambuilder</h2>
      <p className="subtle">
        The working team is saved automatically. Use the controls below to save it as a named team
        and switch between multiple teams.
      </p>

      <div className="format-bar">
        <button className="add-btn" onClick={handleNewTeam}>
          New team
        </button>
        <label className="field small-label">
          <span>Edit saved team</span>
          <select value={loadedId} onChange={(e) => handleLoad(e.target.value)}>
            <option value="">— Select —</option>
            {savedTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field small-label">
          <span>Name</span>
          <input
            value={teamName}
            placeholder="My team"
            onChange={(e) => setTeamName(e.target.value)}
          />
        </label>
        <button className="add-btn" onClick={handleSave}>
          + Save as new team
        </button>
        <button
          className="add-btn"
          onClick={() => {
            if (!loadedId) return
            deleteSavedTeam(loadedId)
            setLoadedId('')
          }}
          disabled={!loadedId}
        >
          Delete
        </button>
        {loadedId && (
          <span className="subtle">Editing “{loadedName}” — changes auto-save.</span>
        )}
      </div>

      <div className="format-bar">
        <span className="small-label" style={{ alignSelf: 'center', fontSize: 12 }}>
          PokePaste:
        </span>
        <button className="add-btn" onClick={copyPaste}>
          Copy
        </button>
        <button className="add-btn" onClick={importClipboard}>
          Paste / Import
        </button>
        <button className="add-btn" onClick={exportFile}>
          Export .txt
        </button>
        <button className="add-btn" onClick={importFile}>
          Import .txt
        </button>
        {ioMsg && <span className="subtle">{ioMsg}</span>}
      </div>

      <h3 className="section-title">My Team</h3>
      <div className="set-list">
        {team.map((s, i) => (
          <PokeSetEditor
            key={s.id}
            set={s}
            title={`Slot ${i + 1}`}
            onChange={(ns) => updateSet('team', ns)}
          />
        ))}
      </div>

      {recommendations.length > 0 && (
        <div className="reco-block">
          <h3 className="section-title">Recommended Teammates</h3>
          <p className="subtle">
            Based on common teammates of your current mons (from Battle Data). Click to add to an
            empty slot.
          </p>
          <div className="chips">
            {recommendations.map((name) => (
              <button key={name} className="chip" onClick={() => addToTeam(name)}>
                + {name}
              </button>
            ))}
          </div>
        </div>
      )}

      <TeamTypeChart />
    </div>
  )
}
