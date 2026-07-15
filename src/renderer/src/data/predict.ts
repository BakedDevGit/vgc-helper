import { Dex } from '@pkmn/dex'
import { gen, findSpecies } from './gen'
import type { PokeSet } from './champions'
import type { MetaMap } from './meta'

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

// --- Ability-interaction warnings ------------------------------------------------
// The type-matchup score above can't see ability effects, so we surface them as
// explicit watch-outs based on YOUR actual moves vs each opponent's possible
// abilities (from Battle Data usage when available, else the dex).

const PRIORITY_BLOCK = new Set(['Armor Tail', 'Dazzling', 'Queenly Majesty'])
// Ability → the move type it makes the holder immune to (absorbs).
const TYPE_IMMUNITY: Record<string, string> = {
  Levitate: 'Ground',
  'Earth Eater': 'Ground',
  'Water Absorb': 'Water',
  'Storm Drain': 'Water',
  'Dry Skin': 'Water',
  'Volt Absorb': 'Electric',
  'Lightning Rod': 'Electric',
  'Motor Drive': 'Electric',
  'Flash Fire': 'Fire',
  'Well-Baked Body': 'Fire',
  'Sap Sipper': 'Grass'
}

export interface MatchupNote {
  opponent: string
  text: string
}

function possibleAbilities(species: string, meta?: MetaMap): { name: string; pct?: string }[] {
  const m = meta?.[species]
  if (m?.abilityStats?.length) return m.abilityStats.map((a) => ({ name: a.name, pct: a.pct }))
  const sp = Dex.species.get(species)
  if (!sp.exists) return []
  return Object.values(sp.abilities ?? {})
    .filter(Boolean)
    .map((name) => ({ name: String(name) }))
}

/** Warn about opponent abilities that neutralize your moves (priority, type, bombs). */
export function analyzeMatchup(
  team: PokeSet[],
  opponents: string[],
  meta?: MetaMap
): MatchupNote[] {
  const userMons = team.filter((s) => s.species)
  const priorityUsers: string[] = []
  const bulletUsers: string[] = []
  const typeUsers = new Map<string, string[]>() // move type → ["Scizor's Bullet Punch", …]

  for (const s of userMons) {
    for (const mvName of s.moves.filter(Boolean)) {
      const mv = gen.moves.get(mvName)
      if (!mv?.exists || mv.category === 'Status') continue
      const label = `${s.species}'s ${mv.name}`
      if (mv.priority > 0) priorityUsers.push(label)
      if ((mv.flags as Record<string, number> | undefined)?.bullet) bulletUsers.push(label)
      const t = mv.type as string
      if (!typeUsers.has(t)) typeUsers.set(t, [])
      typeUsers.get(t)!.push(label)
    }
  }

  const uniq = (a: string[]): string => [...new Set(a)].join(', ')
  const notes: MatchupNote[] = []

  for (const o of opponents.filter(Boolean)) {
    for (const { name, pct } of possibleAbilities(o, meta)) {
      const tag = pct ? ` (${pct})` : ' (possible)'
      if (PRIORITY_BLOCK.has(name) && priorityUsers.length) {
        notes.push({
          opponent: o,
          text: `${o}'s ${name}${tag} blocks your priority moves — ${uniq(priorityUsers)}.`
        })
      }
      if (name === 'Psychic Surge' && priorityUsers.length) {
        notes.push({
          opponent: o,
          text: `${o}'s Psychic Surge${tag} sets Psychic Terrain, blocking priority vs grounded targets — ${uniq(priorityUsers)}.`
        })
      }
      const immune = TYPE_IMMUNITY[name]
      if (immune && typeUsers.has(immune)) {
        notes.push({
          opponent: o,
          text: `${o} can absorb ${immune} moves with ${name}${tag} — ${uniq(typeUsers.get(immune)!)}.`
        })
      }
      if (name === 'Bulletproof' && bulletUsers.length) {
        notes.push({
          opponent: o,
          text: `${o}'s Bulletproof${tag} blocks your ball/bomb moves — ${uniq(bulletUsers)}.`
        })
      }
    }
  }
  return notes
}
