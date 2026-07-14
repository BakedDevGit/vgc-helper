import { Dex } from '@pkmn/dex'
import { ZERO_SPREAD, newSet, type PokeSet, type Spread } from './champions'
import { findSpecies } from './gen'

// Fix battle-data item names that are mistyped at the source (OCR errors).
const ITEM_TYPOS: Record<string, string> = {
  'lron Ball': 'Iron Ball'
}

export const itemExists = (name: string): boolean => Dex.items.get(name).exists

// User-set overrides (raw API name → correct item), synced from the store.
let userItemFixes: Record<string, string> = {}
export function setUserItemFixes(map: Record<string, string>): void {
  userItemFixes = map || {}
}

// Resolve one raw item name. The source can't tell X/Y mega stones apart (both
// come through as e.g. "Charizardite"/"Raichunite"), so we auto-split: occurrence
// 0 → the Y variant (more common), occurrence 1 → X. Manual overrides win.
function resolveItem(raw: string, occurrence: number): string {
  if (userItemFixes[raw]) return userItemFixes[raw]
  const name = ITEM_TYPOS[raw] ?? raw
  if (!itemExists(name) && itemExists(`${name} Y`) && itemExists(`${name} X`)) {
    return occurrence === 0 ? `${name} Y` : `${name} X`
  }
  return name
}

export function correctItem(name: string): string {
  return resolveItem(name, 0)
}

// Correct a ranked usage list, assigning ambiguous variants in order.
export function correctItemStats(stats: UsageStat[]): UsageStat[] {
  const seen: Record<string, number> = {}
  return stats.map((s) => {
    const base = ITEM_TYPOS[s.name] ?? s.name
    const i = seen[base] ?? 0
    seen[base] = i + 1
    return { ...s, name: resolveItem(s.name, i) }
  })
}

// If an item is a Mega Stone for `species`, return the Mega forme name.
export function megaFormeFor(species: string, item: string): string | undefined {
  if (!item) return undefined
  const mega = (Dex.items.get(item) as { megaStone?: Record<string, string> }).megaStone
  return mega && typeof mega === 'object' ? mega[species] : undefined
}

export interface UsageStat {
  name: string
  pct: string // e.g. "89.2%" ("" if not provided)
}

export interface SpreadStat {
  points: Spread
  pct: string
}

// Per-Pokémon usage data for the current regulation.
export interface MetaEntry {
  species: string
  rank: number // usage ranking, 1 = most used (0 = unranked) — set manually
  item: string // most used item (for quick-add sets)
  ability: string // most used ability
  nature: string // most used nature
  points: Spread // most used stat point spread (Champions 66-pt)
  moves: string[] // most used move names, ordered (drives sets/coverage)
  teammates: string[] // most common teammates, ordered
  moveStats: UsageStat[] // moves with usage %
  itemStats: UsageStat[] // all items with usage %
  abilityStats: UsageStat[] // abilities with usage %
  natureStats: UsageStat[] // natures with usage %
  spreadStats: SpreadStat[] // all stat spreads used, with usage %
}

export type MetaMap = Record<string, MetaEntry>

export function newMeta(species = ''): MetaEntry {
  return {
    species,
    rank: 0,
    item: '',
    ability: '',
    nature: '',
    points: { ...ZERO_SPREAD },
    moves: [],
    teammates: [],
    moveStats: [],
    itemStats: [],
    abilityStats: [],
    natureStats: [],
    spreadStats: []
  }
}

// Build a ready-to-use PokeSet from a meta entry (for quick-adding as a target).
// Keeps the BASE forme even if it holds a Mega Stone — the damage calc's Mega
// button / auto-resolve handles the Mega forme.
export function metaToSet(e: MetaEntry): PokeSet {
  const item = correctItem(e.item)
  const sp = findSpecies(e.species)
  return {
    ...newSet(e.species),
    item: item || (sp?.isMega && sp.requiredItem ? sp.requiredItem : ''),
    ability: e.ability || sp?.abilities[0] || '',
    nature: e.nature || 'Hardy',
    moves: [e.moves[0] ?? '', e.moves[1] ?? '', e.moves[2] ?? '', e.moves[3] ?? ''],
    points: { ...e.points }
  }
}
