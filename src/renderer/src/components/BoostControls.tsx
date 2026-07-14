import { BOOST_STATS, ZERO_BOOSTS, type Boosts, type BoostStat } from '../data/calc'

const LABEL: Record<BoostStat, string> = {
  atk: 'Atk',
  def: 'Def',
  spa: 'SpA',
  spd: 'SpD',
  spe: 'Spe'
}

interface Props {
  boosts: Boosts
  onChange: (b: Boosts) => void
}

/** Stat-stage steppers (-6..+6). Swords Dance = Atk +2, Intimidate = Atk -1. */
export default function BoostControls({ boosts, onChange }: Props): JSX.Element {
  function set(stat: BoostStat, v: number): void {
    onChange({ ...boosts, [stat]: Math.max(-6, Math.min(6, v)) })
  }
  const any = BOOST_STATS.some((s) => boosts[s] !== 0)

  return (
    <div className="boosts">
      <span className="boost-label">Boosts</span>
      {BOOST_STATS.map((s) => (
        <div key={s} className="boost-cell">
          <span className="boost-stat">{LABEL[s]}</span>
          <div className="stepper">
            <button onClick={() => set(s, boosts[s] - 1)}>−</button>
            <span className={boosts[s] > 0 ? 'b-up' : boosts[s] < 0 ? 'b-down' : 'b-zero'}>
              {boosts[s] > 0 ? `+${boosts[s]}` : boosts[s]}
            </span>
            <button onClick={() => set(s, boosts[s] + 1)}>+</button>
          </div>
        </div>
      ))}
      {any && (
        <button className="boost-reset" onClick={() => onChange({ ...ZERO_BOOSTS })}>
          reset
        </button>
      )}
    </div>
  )
}
