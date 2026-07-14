import { STAT_ORDER, type StatID } from './gen'

// Champions battle constants.
export const LEVEL = 50
export const POINT_BUDGET = 66
export const PER_STAT_CAP = 32

export type Spread = Record<StatID, number>
export const ZERO_SPREAD: Spread = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }

export interface NatureLike {
  plus?: string
  minus?: string
}

/**
 * Champions stat formula (verified vs in-game: Basculegion Atk base 112,
 * Adamant, 32 pts = 180). Investment points are added BEFORE the nature
 * multiplier, so a boosted/hindered nature also scales the points.
 */
export function champStat(
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

export function computeStats(
  base: Spread,
  points: Spread,
  nat: NatureLike | undefined,
  level = LEVEL
): Spread {
  const out = { ...ZERO_SPREAD }
  for (const s of STAT_ORDER) out[s] = champStat(s, base[s], level, points[s], nat)
  return out
}

export function pointsSpent(points: Spread): number {
  return STAT_ORDER.reduce((a, s) => a + points[s], 0)
}

// A configured Pokémon: species + Champions investment + battle kit.
export interface PokeSet {
  id: string
  species: string
  nature: string
  item: string
  ability: string
  moves: string[] // up to 4
  points: Spread
}

export function newSet(species = ''): PokeSet {
  return {
    id: Math.random().toString(36).slice(2, 10),
    species,
    nature: 'Hardy',
    item: '',
    ability: '',
    moves: ['', '', '', ''],
    points: { ...ZERO_SPREAD }
  }
}
