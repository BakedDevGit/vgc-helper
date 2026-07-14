import { gen, findSpecies, type SpeciesLite } from '../data/gen'
import { useStore } from '../state/store'
import { spriteStyle } from '../data/sprites'
import { type PokeSet } from '../data/champions'

const TYPES = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison',
  'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'
]

// Multiplier of `attackType` hitting a defender with `defTypes`.
function eff(attackType: string, defType: string): number {
  const e = gen.types.get(attackType)?.effectiveness as Record<string, number> | undefined
  return e?.[defType] ?? 1
}
function defMultiplier(attackType: string, defTypes: string[]): number {
  return defTypes.reduce((m, t) => m * eff(attackType, t), 1)
}

function moveType(name: string): string | null {
  const mv = gen.moves.get(name)
  if (!mv || !mv.exists || mv.category === 'Status') return null
  return mv.type
}

function defCell(m: number): { txt: string; cls: string } {
  if (m === 0) return { txt: '0', cls: 'eff-immune' }
  if (m <= 0.25) return { txt: '¼', cls: 'eff-res2' }
  if (m < 1) return { txt: '½', cls: 'eff-res' }
  if (m >= 4) return { txt: '4', cls: 'eff-weak2' }
  if (m > 1) return { txt: '2', cls: 'eff-weak' }
  return { txt: '', cls: '' }
}
// Offensive: super-effective is GOOD (green), resisted/immune is bad (red).
function offCell(m: number): { txt: string; cls: string } {
  if (m === 0) return { txt: '0', cls: 'off-immune' }
  if (m < 1) return { txt: '½', cls: 'off-res' }
  if (m > 1) return { txt: '2', cls: 'off-se' }
  return { txt: '', cls: '' }
}

interface Member {
  set: PokeSet
  sp: SpeciesLite
  atkTypes: string[]
}

export default function TeamTypeChart(): JSX.Element | null {
  const { team } = useStore()
  const members: Member[] = team
    .filter((s) => s.species)
    .map((s) => {
      const sp = findSpecies(s.species)
      const dmg = new Set<string>()
      for (const mv of s.moves) {
        const t = moveType(mv)
        if (t) dmg.add(t)
      }
      return sp ? { set: s, sp, atkTypes: dmg.size ? [...dmg] : sp.types } : null
    })
    .filter((x): x is Member => !!x)

  if (members.length === 0) return null

  const weakCount = TYPES.map((t) => members.filter((m) => defMultiplier(t, m.sp.types) > 1).length)
  // Best offensive multiplier each member reaches vs a given (mono) defending type.
  const bestOff = (m: Member, defType: string): number =>
    Math.max(...m.atkTypes.map((a) => eff(a, defType)), 0)
  const seCount = TYPES.map((t) => members.filter((m) => bestOff(m, t) > 1).length)

  const header = (
    <tr>
      <th />
      {TYPES.map((t) => (
        <th key={t} className={`tc-head type-${t.toLowerCase()}`} title={t}>
          {t.slice(0, 3)}
        </th>
      ))}
    </tr>
  )

  return (
    <div className="reco-block">
      <h3 className="section-title">Type Matchups — Defense</h3>
      <p className="subtle">How each member takes damage from every attacking type (types only).</p>
      <div className="type-chart-wrap">
        <table className="type-chart">
          <thead>{header}</thead>
          <tbody>
            {members.map(({ set, sp }) => (
              <tr key={set.id}>
                <td className="tc-name">
                  <span className="sprite" style={spriteStyle(sp.name)} />
                  {sp.name}
                </td>
                {TYPES.map((t) => {
                  const c = defCell(defMultiplier(t, sp.types))
                  return (
                    <td key={t} className={c.cls}>
                      {c.txt}
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr className="tc-summary">
              <td className="tc-name">Weak count</td>
              {weakCount.map((n, i) => (
                <td key={i} className={n >= 2 ? 'eff-weak' : ''}>
                  {n || ''}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="section-title">Type Matchups — Offense (coverage)</h3>
      <p className="subtle">
        Best multiplier each member hits a type for, using its damaging moves (or its own types if no
        moves set). Bottom row flags types nothing on the team hits super-effectively.
      </p>
      <div className="type-chart-wrap">
        <table className="type-chart">
          <thead>{header}</thead>
          <tbody>
            {members.map(({ set, sp, atkTypes }) => (
              <tr key={set.id}>
                <td className="tc-name">
                  <span className="sprite" style={spriteStyle(sp.name)} />
                  {sp.name}
                </td>
                {TYPES.map((t) => {
                  const c = offCell(bestOff({ set, sp, atkTypes }, t))
                  return (
                    <td key={t} className={c.cls}>
                      {c.txt}
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr className="tc-summary">
              <td className="tc-name">SE count</td>
              {seCount.map((n, i) => (
                <td key={i} className={n === 0 ? 'off-immune' : ''}>
                  {n || '0'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
