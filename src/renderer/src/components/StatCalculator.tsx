import { useEffect, useMemo, useState } from 'react'
import { gen, findSpecies, STAT_ORDER, STAT_LABEL, type StatID } from '../data/gen'
import { useLegalSpeciesNames } from '../state/store'
import { spriteStyle } from '../data/sprites'
import SearchSelect from './SearchSelect'

type Spread = Record<StatID, number>
const ZERO: Spread = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }

// --- Pokémon Champions investment system ---------------------------------
// Confirmed against in-game values (Basculegion Atk 112, Adamant, 32 pts = 180):
//   non-HP: floor( (floor((2*base + 31) * level/100) + 5 + points) * natureMod )
//   HP:     floor((2*base + 31) * level/100) + level + 10 + points
// Points are added BEFORE the nature multiplier, so a boosted/hindered nature
// also scales the invested points (1 pt = +1.1 on a + stat, +0.9 on a - stat).
const POINT_BUDGET = 66
const PER_STAT_CAP = 32

interface NatureLike {
  plus?: string
  minus?: string
}

function champStat(
  stat: StatID,
  base: number,
  level: number,
  points: number,
  nat: NatureLike | undefined
): number {
  if (stat === 'hp') {
    if (base === 1) return 1 // Shedinja
    return Math.floor((2 * base + 31) * level / 100) + level + 10 + points
  }
  let mod = 1
  if (nat?.plus === stat && nat.minus !== stat) mod = 1.1
  else if (nat?.minus === stat && nat.plus !== stat) mod = 0.9
  const inner = Math.floor((2 * base + 31) * level / 100) + 5 + points
  return Math.floor(inner * mod)
}

const NATURES = Array.from(gen.natures).map((n) => n.name).sort()

export default function StatCalculator(): JSX.Element {
  const speciesNames = useLegalSpeciesNames()
  const [name, setName] = useState('')
  // Default to the first legal Pokémon, and re-pick if the current one becomes illegal.
  useEffect(() => {
    if (!speciesNames.includes(name)) setName(speciesNames[0] ?? '')
  }, [speciesNames, name])
  const [nature, setNature] = useState('Timid')
  const [invest, setInvest] = useState<Spread>({ ...ZERO })

  const sp = findSpecies(name)
  const natureObj = gen.natures.get(nature)
  const pointsUsed = STAT_ORDER.reduce((a, s) => a + invest[s], 0)
  const pointsLeft = POINT_BUDGET - pointsUsed

  const finalStats: Spread | null = useMemo(() => {
    if (!sp) return null
    const out = { ...ZERO }
    for (const s of STAT_ORDER) {
      out[s] = champStat(s, sp.baseStats[s], 50, invest[s], natureObj)
    }
    return out
  }, [sp, natureObj, invest])

  const maxFor = (stat: StatID): number =>
    Math.min(PER_STAT_CAP, invest[stat] + Math.max(0, pointsLeft))
  function setPoints(stat: StatID, raw: number): void {
    const v = Math.max(0, Math.min(maxFor(stat), Math.floor(raw) || 0))
    setInvest((prev) => ({ ...prev, [stat]: v }))
  }

  function natureArrow(stat: StatID): JSX.Element | null {
    if (!natureObj) return null
    if (natureObj.plus === stat && natureObj.minus !== stat)
      return <span className="arrow-up">▲</span>
    if (natureObj.minus === stat && natureObj.plus !== stat)
      return <span className="arrow-down">▼</span>
    return null
  }

  return (
    <div className="panel">
      <h2>Stat Calculator</h2>

      <div className="row">
        <label className="field">
          <span>Pokémon</span>
          <SearchSelect
            value={name}
            onChange={setName}
            options={speciesNames}
            placeholder="Search Pokémon…"
          />
        </label>

        <label className="field">
          <span>Nature</span>
          <select value={nature} onChange={(e) => setNature(e.target.value)}>
            {NATURES.map((n) => {
              const no = gen.natures.get(n)
              const tag =
                no && no.plus && no.minus
                  ? ` (+${STAT_LABEL[no.plus as StatID]}/-${STAT_LABEL[no.minus as StatID]})`
                  : ' (neutral)'
              return (
                <option key={n} value={n}>
                  {n}
                  {tag}
                </option>
              )
            })}
          </select>
        </label>
      </div>

      {!sp && <p className="warn">No Pokémon named “{name}”. Pick one from the list.</p>}

      {sp && finalStats && (
        <>
          <div className="species-head">
            <span className="sprite" style={spriteStyle(sp.name)} />
            <strong>{sp.name}</strong>
            <span className="types">
              {sp.types.map((t) => (
                <span key={t} className={`type type-${t.toLowerCase()}`}>
                  {t}
                </span>
              ))}
            </span>
            <span className="bst">BST {STAT_ORDER.reduce((a, s) => a + sp.baseStats[s], 0)}</span>
          </div>

          <table className="stat-table">
            <thead>
              <tr>
                <th>Stat</th>
                <th>Base</th>
                <th>Points</th>
                <th>Final</th>
              </tr>
            </thead>
            <tbody>
              {STAT_ORDER.map((s) => (
                <tr key={s}>
                  <td className="stat-name">
                    {STAT_LABEL[s]} {natureArrow(s)}
                  </td>
                  <td>{sp.baseStats[s]}</td>
                  <td className="points-cell">
                    <input
                      type="range"
                      min={0}
                      max={maxFor(s)}
                      value={invest[s]}
                      onChange={(e) => setPoints(s, Number(e.target.value))}
                    />
                    <span className="slider-val">{invest[s]}</span>
                  </td>
                  <td className="final">{finalStats[s]}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={pointsLeft < 0 ? 'ev-total over' : 'ev-total'}>
            Points spent: {pointsUsed} / {POINT_BUDGET}
            {pointsLeft >= 0 ? ` — ${pointsLeft} left` : ' — over budget!'}
          </div>

          <div className="quick-spreads">
            <button onClick={() => setInvest({ ...ZERO })}>Clear points</button>
          </div>
        </>
      )}
    </div>
  )
}
