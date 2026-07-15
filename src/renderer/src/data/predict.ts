import { gen, findSpecies } from './gen'
import type { PokeSet } from './champions'

// Lightweight Team-Preview predictor. It scores matchups by type effectiveness:
// how hard each mon hits the other and how well it resists back. It's a heuristic
// starting point (types only — no abilities/spreads/speed nuance), meant to be
// adjusted by the user, not treated as gospel.

export type Role = 'bring' | 'lead'
export interface MatchupPrediction {
  oppPicks: Record<string, Role> // keyed by opponent species name
  userPicks: Record<string, Role> // keyed by user set.id
}

function typeMult(atkType: string, defTypes: string[]): number {
  const eff = gen.types.get(atkType)?.effectiveness as Record<string, number> | undefined
  if (!eff) return 1
  return defTypes.reduce((m, d) => m * (eff[d] ?? 1), 1)
}

function speciesTypes(name: string): string[] {
  const sp = findSpecies(name)
  return sp ? (sp.types as string[]) : []
}

// A user set's offensive types = its damaging moves' types (STAB-ish coverage);
// fall back to its own typing if it has no damaging moves selected.
function userOffense(set: PokeSet): string[] {
  const dmg = set.moves
    .filter(Boolean)
    .map((m) => gen.moves.get(m))
    .filter((mv) => mv?.exists && mv.category !== 'Status')
    .map((mv) => mv!.type as string)
  return dmg.length ? dmg : speciesTypes(set.species)
}

const bestOff = (atkTypes: string[], defTypes: string[]): number =>
  atkTypes.length && defTypes.length
    ? Math.max(...atkTypes.map((t) => typeMult(t, defTypes)))
    : 1

// Advantage of A over B: how much harder A hits B than B hits A (positive favors A).
function advantage(
  aOff: string[],
  aDef: string[],
  bOff: string[],
  bDef: string[]
): number {
  return bestOff(aOff, bDef) - bestOff(bOff, aDef)
}

interface Fighter {
  key: string
  off: string[]
  def: string[]
}

function rankAgainst(side: Fighter[], foes: Fighter[]): string[] {
  return [...side]
    .map((f) => ({
      key: f.key,
      score: foes.reduce((s, g) => s + advantage(f.off, f.def, g.off, g.def), 0)
    }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.key)
}

const toPicks = (ranked: string[]): Record<string, Role> => {
  const picks: Record<string, Role> = {}
  ranked.slice(0, 4).forEach((k, i) => (picks[k] = i < 2 ? 'lead' : 'bring'))
  return picks
}

/**
 * Predict the opponent's likely 4 brings + 2 leads against `team`, then the user's
 * best 4 + 2 leads against that predicted bring. Both editable afterward.
 */
export function predictMatchup(team: PokeSet[], opponents: string[]): MatchupPrediction {
  const userMons = team.filter((s) => s.species)
  const oppFighters: Fighter[] = opponents
    .filter(Boolean)
    .map((o) => ({ key: o, off: speciesTypes(o), def: speciesTypes(o) }))
  const userFighters: Fighter[] = userMons.map((s) => ({
    key: s.id,
    off: userOffense(s),
    def: speciesTypes(s.species)
  }))

  if (oppFighters.length === 0 || userFighters.length === 0) {
    return { oppPicks: {}, userPicks: {} }
  }

  // Their likely bring vs the whole user team.
  const oppRanked = rankAgainst(oppFighters, userFighters)
  const oppPicks = toPicks(oppRanked)
  const oppBringKeys = new Set(Object.keys(oppPicks))
  const predictedOpp = oppFighters.filter((f) => oppBringKeys.has(f.key))

  // User's best counter vs their predicted bring.
  const userRanked = rankAgainst(userFighters, predictedOpp)
  const userPicks = toPicks(userRanked)

  return { oppPicks, userPicks }
}
