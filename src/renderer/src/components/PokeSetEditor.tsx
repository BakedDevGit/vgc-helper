import { useEffect, useMemo, useState } from 'react'
import {
  gen,
  findSpecies,
  listMoves,
  learnableMoves,
  STAT_LABEL,
  type StatID
} from '../data/gen'
import { computeStats, type PokeSet } from '../data/champions'
import { spriteStyle, itemSpriteStyle } from '../data/sprites'
import { useLegalSpeciesNames, useLegalItems, useStore } from '../state/store'
import SearchSelect from './SearchSelect'
import PointsEditor from './PointsEditor'

const NATURES = Array.from(gen.natures).map((n) => n.name).sort()

interface Props {
  set: PokeSet
  onChange: (set: PokeSet) => void
  onRemove?: () => void
  title?: string
}

export default function PokeSetEditor({ set, onChange, onRemove, title }: Props): JSX.Element {
  const speciesNames = useLegalSpeciesNames()
  const items = useLegalItems()
  const { dataVersion } = useStore()
  const allMoves = useMemo(() => listMoves(), [])

  // Only offer moves the species can learn (async; show all until it loads).
  const [learnable, setLearnable] = useState<Set<string> | null>(null)
  useEffect(() => {
    let cancelled = false
    if (!set.species) {
      setLearnable(null)
      return
    }
    learnableMoves(set.species).then((s) => {
      if (!cancelled) setLearnable(s)
    })
    return () => {
      cancelled = true
    }
  }, [set.species, dataVersion])
  const moves = useMemo(
    () => (learnable && learnable.size ? allMoves.filter((m) => learnable.has(m)) : allMoves),
    [allMoves, learnable]
  )

  const sp = findSpecies(set.species)
  const natObj = gen.natures.get(set.nature)
  const final = sp ? computeStats(sp.baseStats, set.points, natObj) : null

  function patch(p: Partial<PokeSet>): void {
    onChange({ ...set, ...p })
  }
  function setMove(i: number, v: string): void {
    const m = [...set.moves]
    m[i] = v
    patch({ moves: m })
  }
  function pickSpecies(name: string): void {
    const s = findSpecies(name)
    // Default the ability to the species' first ability, and auto-fill the
    // required Mega Stone / orb when picking a Mega or Primal forme.
    patch({
      species: name,
      ability: s?.abilities[0] ?? '',
      ...(s?.isMega && s.requiredItem ? { item: s.requiredItem } : {})
    })
  }

  return (
    <div className="set-editor">
      <div className="set-head">
        <div className="set-title">
          {sp && <span className="sprite" style={spriteStyle(set.species)} />}
          {title ?? sp?.name ?? 'Empty slot'}
        </div>
        {onRemove && (
          <button className="x-btn" onClick={onRemove} title="Remove">
            ✕
          </button>
        )}
      </div>

      <div className="set-grid">
        <label className="field">
          <span>Pokémon</span>
          <SearchSelect
            value={set.species}
            onChange={pickSpecies}
            options={speciesNames}
            placeholder="Search…"
          />
        </label>
        <label className="field">
          <span>Ability</span>
          <select value={set.ability} onChange={(e) => patch({ ability: e.target.value })}>
            <option value="">—</option>
            {(sp?.abilities ?? []).map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
            {set.ability && !sp?.abilities.includes(set.ability) && (
              <option value={set.ability}>{set.ability}</option>
            )}
          </select>
        </label>
      </div>

      <div className="set-mid">
        <div className="set-moves-col">
          <span className="col-label">Moves</span>
          {[0, 1, 2, 3].map((i) => {
            const mv = set.moves[i] ? gen.moves.get(set.moves[i]) : undefined
            const type = mv && mv.exists ? (mv.type as string) : ''
            return (
              <div key={i} className="move-row">
                <SearchSelect
                  value={set.moves[i] ?? ''}
                  onChange={(v) => setMove(i, v)}
                  options={moves}
                  placeholder={`Move ${i + 1}`}
                />
                {type && <span className={`type type-${type.toLowerCase()}`}>{type}</span>}
              </div>
            )
          })}
        </div>
        <div className="set-points-col">
          <span className="col-label">Stat points</span>
          <PointsEditor points={set.points} onChange={(p) => patch({ points: p })} final={final} />
        </div>
      </div>

      <div className="set-grid">
        <label className="field">
          <span>Item</span>
          <div className="with-icon">
            {set.item && <span className="item-icon" style={itemSpriteStyle(set.item)} />}
            <SearchSelect
              value={set.item}
              onChange={(v) => patch({ item: v })}
              options={items}
              placeholder="None"
            />
          </div>
        </label>
        <label className="field">
          <span>Nature</span>
          <select value={set.nature} onChange={(e) => patch({ nature: e.target.value })}>
            {NATURES.map((n) => {
              const no = gen.natures.get(n)
              const tag =
                no && no.plus && no.minus
                  ? ` (+${STAT_LABEL[no.plus as StatID]}/-${STAT_LABEL[no.minus as StatID]})`
                  : ''
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
    </div>
  )
}
