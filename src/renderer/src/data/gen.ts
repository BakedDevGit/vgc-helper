import { Dex } from '@pkmn/dex'
import { Generations, type Generation } from '@pkmn/data'

// Single shared Gen 9 generation used for browsing species/moves/items/abilities.
const generations = new Generations(Dex)
export const gen: Generation = generations.get(9)

export type StatID = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe'

export const STAT_ORDER: StatID[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe']
export const STAT_LABEL: Record<StatID, string> = {
  hp: 'HP',
  atk: 'Atk',
  def: 'Def',
  spa: 'SpA',
  spd: 'SpD',
  spe: 'Spe'
}

export interface SpeciesLite {
  name: string
  num: number
  types: string[]
  baseStats: Record<StatID, number>
  abilities: string[]
  isMega?: boolean
  requiredItem?: string
  baseSpecies?: string
}

interface RawSpecies {
  name: string
  num: number
  types: readonly string[]
  baseStats: Record<StatID, number>
  abilities: Record<string, string>
  requiredItem?: string
  baseSpecies?: string
}

function toLite(s: RawSpecies, isMega = false): SpeciesLite {
  return {
    name: s.name,
    num: s.num,
    types: s.types as string[],
    baseStats: {
      hp: s.baseStats.hp,
      atk: s.baseStats.atk,
      def: s.baseStats.def,
      spa: s.baseStats.spa,
      spd: s.baseStats.spd,
      spe: s.baseStats.spe
    },
    abilities: Object.values(s.abilities),
    isMega: isMega || undefined,
    requiredItem: s.requiredItem || undefined,
    baseSpecies: s.baseSpecies || undefined
  }
}

let _speciesCache: SpeciesLite[] | null = null

// Every real Pokémon (full National Dex) plus their formes, incl. Megas/Primals.
// Champions isn't limited to the SV dex, so we don't filter by gen — the Legality
// tab is what defines the legal format. Excludes CAP/Custom fakemons, LGPE-only
// and Gmax/Totem formes, and duplicate cosmetic patterns.
export function listSpecies(): SpeciesLite[] {
  if (_speciesCache) return _speciesCache

  // A forme is "real" if its base species is a genuine Pokémon (standard or past-gen,
  // not a CAP/Custom fakemon). This keeps Mega-Barbaracle (real base) but drops
  // Crucibelle (fake base).
  const realBase = (name: string): boolean => {
    const b = Dex.species.get(name)
    return !!(b && b.exists && (!b.isNonstandard || b.isNonstandard === 'Past'))
  }
  // Collect cosmetic-only forme names (e.g. Vivillon patterns) to drop the dupes.
  const cosmetic = new Set<string>()
  for (const s of Dex.species.all()) {
    const cf = (s as { cosmeticFormes?: readonly string[] }).cosmeticFormes
    if (cf) for (const c of cf) cosmetic.add(c)
  }

  const out: SpeciesLite[] = []
  for (const s of Dex.species.all()) {
    if (!s.exists || s.num <= 0) continue
    if (cosmetic.has(s.name)) continue
    if (!realBase(s.baseSpecies || s.name)) continue
    if (/-(Gmax|Totem)$/.test(s.name)) continue
    if (s.isNonstandard === 'Custom' || s.isNonstandard === 'LGPE') continue
    out.push(toLite(s as unknown as RawSpecies, /-(Mega|Primal)/.test(s.name)))
  }

  out.sort((a, b) => a.name.localeCompare(b.name))
  _speciesCache = out
  return out
}

export function findSpecies(name: string): SpeciesLite | undefined {
  return listSpecies().find((s) => s.name === name)
}

function sortedNames(iter: Iterable<{ name: string; isNonstandard?: unknown }>): string[] {
  const out: string[] = []
  for (const x of iter) {
    if (x.isNonstandard) continue
    out.push(x.name)
  }
  return out.sort((a, b) => a.localeCompare(b))
}

let _moves: string[] | null = null
let _items: string[] | null = null
let _abilities: string[] | null = null

export function listMoves(): string[] {
  return (_moves ??= sortedNames(gen.moves))
}
export function listItems(): string[] {
  if (_items) return _items
  const out = sortedNames(gen.items)
  // Mega stones and the Primal orbs live only in the cross-gen dex.
  for (const it of Dex.items.all()) {
    if (!it.exists) continue
    const isStone = !!(it as { megaStone?: unknown }).megaStone
    if (isStone || it.name === 'Red Orb' || it.name === 'Blue Orb') out.push(it.name)
  }
  _items = [...new Set(out)].sort((a, b) => a.localeCompare(b))
  return _items
}
export function listAbilities(): string[] {
  return (_abilities ??= sortedNames(gen.abilities))
}

export interface MoveData {
  name: string
  type: string
  category: string // Physical | Special | Status
  power: number // 0 = no fixed power
  accuracy: number // 0 = never misses
  pp: number
  priority: number
  desc: string
}
// Champions-specific move corrections (mechanics that differ from standard gen 9
// and aren't in the Showdown data). Keyed by move name.
const CHAMPIONS_MOVE_OVERRIDES: Record<string, Partial<MoveData>> = {
  // Champions raised Make It Rain's self Sp. Atk drop from 1 stage to 2.
  'Make It Rain': { desc: "Lowers the user's Sp. Atk by 2. Hits foe(s)." }
}

let _moveData: MoveData[] | null = null
export function listMoveData(): MoveData[] {
  if (_moveData) return _moveData
  const out: MoveData[] = []
  for (const m of gen.moves) {
    if (m.isNonstandard) continue
    out.push({
      name: m.name,
      type: m.type as string,
      category: m.category as string,
      power: m.basePower,
      accuracy: m.accuracy === true ? 0 : m.accuracy,
      pp: m.pp,
      priority: m.priority,
      desc: m.shortDesc || m.desc || '',
      ...CHAMPIONS_MOVE_OVERRIDES[m.name]
    })
  }
  out.sort((a, b) => a.name.localeCompare(b.name))
  _moveData = out
  return out
}

export interface ItemData {
  name: string
  desc: string
}
let _itemData: ItemData[] | null = null
export function listItemData(): ItemData[] {
  if (_itemData) return _itemData
  _itemData = listItems().map((name) => ({
    name,
    desc: (Dex.items.get(name).desc as string) || ''
  }))
  return _itemData
}

// Move NAMES learnable by a species (walks up the prevo / base-forme chain).
export async function learnableMoves(speciesName: string): Promise<Set<string>> {
  const out = new Set<string>()
  const seen = new Set<string>()
  let cur: string | undefined = speciesName
  while (cur && !seen.has(cur)) {
    seen.add(cur)
    const sp = Dex.species.get(cur)
    if (!sp.exists) break
    const ls = await gen.learnsets.get(cur as never)
    const learnset = (ls as { learnset?: Record<string, unknown> })?.learnset
    if (learnset) {
      for (const id of Object.keys(learnset)) {
        const mv = gen.moves.get(id)
        if (mv?.exists) out.add(mv.name)
      }
    }
    cur = sp.prevo || (sp.baseSpecies !== sp.name ? sp.baseSpecies : undefined)
  }
  return out
}
