import { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { newSet, type PokeSet } from '../data/champions'
import { runCalc, ZERO_BOOSTS, DEFAULT_FIELD, type FieldOpts, type Boosts } from '../data/calc'
import { metaToSet, megaFormeFor } from '../data/meta'
import { findSpecies } from '../data/gen'
import { spriteStyle } from '../data/sprites'
import PokeSetEditor from './PokeSetEditor'
import BoostControls from './BoostControls'
import FieldPanel from './FieldPanel'

function clone(set: PokeSet): PokeSet {
  return { ...JSON.parse(JSON.stringify(set)), id: newSet().id }
}

function pctClass(p: number): string {
  if (p >= 100) return 'dmg-ko'
  if (p >= 50) return 'dmg-high'
  if (p >= 25) return 'dmg-mid'
  return 'dmg-low'
}

export default function DamageCalculator(): JSX.Element {
  const { team, benchmarks, updateBenchmarks, updateSet, meta } = useStore()
  const [editTargets, setEditTargets] = useState(false)

  // Top 15 ranked meta mons for one-click adding as targets.
  const topMeta = useMemo(
    () =>
      Object.values(meta)
        .filter((e) => e.rank > 0)
        .sort((a, b) => a.rank - b.rank)
        .slice(0, 15),
    [meta]
  )

  function addBenchmark(): void {
    updateBenchmarks([...benchmarks, newSet()])
    setEditTargets(true)
  }
  function addBenchFromMeta(species: string): void {
    if (benchmarks.some((b) => b.species === species)) return
    const e = meta[species]
    if (e) updateBenchmarks([...benchmarks, metaToSet(e)])
  }
  function removeBenchmark(id: string): void {
    updateBenchmarks(benchmarks.filter((b) => b.id !== id))
  }

  const [attacker, setAttacker] = useState<PokeSet>(() => newSet())
  const [defender, setDefender] = useState<PokeSet>(() => newSet())
  const [atkMove, setAtkMove] = useState('')
  const [defMove, setDefMove] = useState('')
  const [activeSide, setActiveSide] = useState<'atk' | 'def'>('atk')
  const [atkBoosts, setAtkBoosts] = useState<Boosts>({ ...ZERO_BOOSTS })
  const [defBoosts, setDefBoosts] = useState<Boosts>({ ...ZERO_BOOSTS })
  const [field, setField] = useState<FieldOpts>({ ...DEFAULT_FIELD })

  // Mega Evolution: the button flips the actual species between base and Mega forme.
  function megaInfo(set: PokeSet): { canMega: boolean; isMega: boolean; base: string; forme?: string } {
    const sp = findSpecies(set.species)
    const base = sp?.isMega ? sp.baseSpecies ?? set.species : set.species
    const forme = megaFormeFor(base, set.item)
    return { canMega: !!forme, isMega: !!forme && set.species === forme, base, forme }
  }
  function toggleMega(set: PokeSet, setter: (s: PokeSet) => void): void {
    const { canMega, isMega, base, forme } = megaInfo(set)
    if (!canMega || !forme) return
    const target = isMega ? base : forme
    setter({ ...set, species: target, ability: findSpecies(target)?.abilities[0] ?? set.ability })
  }
  // Benchmarks auto-resolve a held stone to its Mega forme (no per-target toggle).
  function withMega(set: PokeSet): PokeSet {
    const forme = megaFormeFor(set.species, set.item)
    if (!forme) return set
    return { ...set, species: forme, ability: findSpecies(forme)?.abilities[0] ?? set.ability }
  }
  const atkMega = megaInfo(attacker)
  const defMega = megaInfo(defender)

  // Attacker quick-picks come from your team; defender quick-picks from benchmark targets.
  const teamPicks = useMemo(
    () => team.filter((s) => s.species).map((s) => ({ id: s.id, name: s.species, set: s })),
    [team]
  )
  const benchPicks = useMemo(
    () => benchmarks.filter((s) => s.species).map((s) => ({ id: s.id, name: s.species, set: s })),
    [benchmarks]
  )

  // When the defender attacks, sides swap.
  const incomingField: FieldOpts = { ...field, atk: field.def, def: field.atk }
  // The result reacts to whichever side's move was last picked.
  const result =
    activeSide === 'atk'
      ? runCalc(attacker, defender, atkMove, field, atkBoosts, defBoosts)
      : runCalc(defender, attacker, defMove, incomingField, defBoosts, atkBoosts)

  function loadFrom(
    list: { id: string; set: PokeSet }[],
    id: string,
    setter: (s: PokeSet) => void,
    clearMove: () => void
  ): void {
    const opt = list.find((p) => p.id === id)
    if (!opt) return
    setter(clone(opt.set))
    clearMove() // the new mon may not have the previously-selected move
  }
  function onAttackerChange(ns: PokeSet): void {
    if (ns.species !== attacker.species) setAtkMove('')
    setAttacker(ns)
  }
  function onDefenderChange(ns: PokeSet): void {
    if (ns.species !== defender.species) setDefMove('')
    setDefender(ns)
  }

  // A move picker for one side; clicking a move makes that side the active calc direction.
  function moveBar(side: 'atk' | 'def', set: PokeSet, move: string): JSX.Element {
    const moves = set.moves.filter(Boolean)
    return (
      <div className="move-bar">
        <span className="move-label">{side === 'atk' ? 'Attacker' : 'Defender'} move:</span>
        {moves.length === 0 ? (
          <span className="subtle">— no moves set —</span>
        ) : (
          moves.map((m) => (
            <button
              key={m}
              className={activeSide === side && move === m ? 'move-chip active' : 'move-chip'}
              onClick={() => {
                ;(side === 'atk' ? setAtkMove : setDefMove)(m)
                setActiveSide(side)
              }}
            >
              {m}
            </button>
          ))
        )}
      </div>
    )
  }

  return (
    <div className="panel full">
      <h2>Damage Calculator</h2>

      <FieldPanel field={field} onChange={setField} />

      <div className="calc-cols">
        <div className="calc-col">
          <div className="col-head">
            <h3>Attacker</h3>
            <select
              className="quick-pick"
              value=""
              onChange={(e) => loadFrom(teamPicks, e.target.value, setAttacker, () => setAtkMove(''))}
            >
              <option value="">Quick pick from team…</option>
              {teamPicks.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <PokeSetEditor set={attacker} onChange={onAttackerChange} />
          <BoostControls boosts={atkBoosts} onChange={setAtkBoosts} />
          {atkMega.canMega && (
            <button
              className={atkMega.isMega ? 'mega-btn active' : 'mega-btn'}
              onClick={() => toggleMega(attacker, setAttacker)}
            >
              Mega Evolve{atkMega.isMega ? ' ✓' : ''}
            </button>
          )}
        </div>

        <div className="calc-col">
          <div className="col-head">
            <h3>Defender</h3>
            <select
              className="quick-pick"
              value=""
              onChange={(e) => loadFrom(benchPicks, e.target.value, setDefender, () => setDefMove(''))}
            >
              <option value="">Quick pick from targets…</option>
              {benchPicks.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <PokeSetEditor set={defender} onChange={onDefenderChange} />
          <BoostControls boosts={defBoosts} onChange={setDefBoosts} />
          {defMega.canMega && (
            <button
              className={defMega.isMega ? 'mega-btn active' : 'mega-btn'}
              onClick={() => toggleMega(defender, setDefender)}
            >
              Mega Evolve{defMega.isMega ? ' ✓' : ''}
            </button>
          )}
        </div>
      </div>

      <div className="move-cols">
        {moveBar('atk', attacker, atkMove)}
        {moveBar('def', defender, defMove)}
      </div>

      <div className="result-card">
        {result.error ? (
          <div className="subtle">{result.error}</div>
        ) : (
          <>
            <div className="result-pct">
              <span className={pctClass(result.maxPct)}>
                {result.minPct}% – {result.maxPct}%
              </span>
              {result.koText && <span className="ko-text">{result.koText}</span>}
            </div>
            <div className="result-desc">{result.desc}</div>
          </>
        )}
      </div>

      <div className="benchmark-block">
        <div className="section-head">
          <h3 className="section-title">Benchmark Targets ({benchmarks.length})</h3>
          <div className="bench-actions">
            {benchmarks.length > 0 && (
              <button className="add-btn" onClick={() => setEditTargets((v) => !v)}>
                {editTargets ? 'Hide targets' : 'Edit targets'}
              </button>
            )}
            <button className="add-btn" onClick={addBenchmark}>
              + Add target
            </button>
          </div>
        </div>
        <p className="subtle">
          Common threats to quickly calc against. Saved automatically and shared with the
          Teambuilder quick-picks. Add as many as you like.
        </p>

        {topMeta.length > 0 && (
          <div className="meta-quick-row">
            <span className="subtle">Top meta:</span>
            {topMeta.map((e) => {
              const added = benchmarks.some((b) => b.species === e.species)
              return (
                <button
                  key={e.species}
                  className="meta-quick"
                  onClick={() => addBenchFromMeta(e.species)}
                  disabled={added}
                  title={added ? 'Already a target' : `Add ${e.species}`}
                >
                  <span className="sprite" style={spriteStyle(e.species)} />
                  <span className="mq-name">
                    #{e.rank} {e.species}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {editTargets && (
          <div className="set-list">
            {benchmarks.map((s) => (
              <PokeSetEditor
                key={s.id}
                set={s}
                onChange={(ns) => updateSet('benchmarks', ns)}
                onRemove={() => removeBenchmark(s.id)}
              />
            ))}
          </div>
        )}
      </div>

      {benchmarks.filter((b) => b.species).length > 0 && (
        <div className="benchmark-block">
          <h3 className="section-title">
            {attacker.species || 'Attacker'} {atkMove ? `· ${atkMove}` : ''} vs Targets
          </h3>
          <table className="bench-table">
            <thead>
              <tr>
                <th>Target</th>
                <th>Damage</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {benchmarks
                .filter((b) => b.species)
                .map((b) => {
                  const r = runCalc(attacker, withMega(b), atkMove, field, atkBoosts)
                  return (
                    <tr key={b.id}>
                      <td className="stat-name">{b.species}</td>
                      <td>
                        {r.error ? (
                          <span className="subtle">—</span>
                        ) : (
                          <span className={pctClass(r.maxPct)}>
                            {r.minPct}% – {r.maxPct}%
                          </span>
                        )}
                      </td>
                      <td className="subtle">{r.error ? r.error : r.koText || '—'}</td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
