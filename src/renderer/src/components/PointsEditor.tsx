import { STAT_ORDER, STAT_LABEL, type StatID } from '../data/gen'
import { pointsSpent, POINT_BUDGET, PER_STAT_CAP, type Spread } from '../data/champions'

interface Props {
  points: Spread
  onChange: (p: Spread) => void
  /** Optional final-stat preview shown next to each slider. */
  final?: Spread | null
}

export default function PointsEditor({ points, onChange, final }: Props): JSX.Element {
  const spent = pointsSpent(points)
  const remaining = POINT_BUDGET - spent
  // A slider can't go past what the remaining budget allows (or the 32 cap).
  const maxFor = (s: StatID): number => Math.min(PER_STAT_CAP, points[s] + Math.max(0, remaining))
  function setPoint(stat: StatID, raw: number): void {
    const v = Math.max(0, Math.min(maxFor(stat), Math.floor(raw) || 0))
    onChange({ ...points, [stat]: v })
  }
  return (
    <div className="points-sliders">
      {STAT_ORDER.map((s) => (
        <div key={s} className="slider-row">
          <label className="slider-label">{STAT_LABEL[s]}</label>
          <input
            type="range"
            min={0}
            max={maxFor(s)}
            value={points[s]}
            onChange={(e) => setPoint(s, Number(e.target.value))}
          />
          <span className="slider-val">{points[s]}</span>
          {final && <span className="final-mini">{final[s]}</span>}
        </div>
      ))}
      <div className={spent > POINT_BUDGET ? 'point-budget over' : 'point-budget'}>
        {spent}/{POINT_BUDGET} points
      </div>
    </div>
  )
}
