import { Pokemon as CalcPokemon, Move as CalcMove, Field, calculate } from '@smogon/calc'
import { gen, findSpecies, STAT_ORDER } from './gen'
import { computeStats, pointsSpent, LEVEL, type PokeSet } from './champions'

const GEN = 9

// Stat-stage boosts (-6..+6), no HP. e.g. Swords Dance = atk +2, Intimidate = atk -1.
export type BoostStat = 'atk' | 'def' | 'spa' | 'spd' | 'spe'
export type Boosts = Record<BoostStat, number>
export const BOOST_STATS: BoostStat[] = ['atk', 'def', 'spa', 'spd', 'spe']
export const ZERO_BOOSTS: Boosts = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }

function boostText(b: Boosts | undefined): string {
  if (!b) return ''
  const parts = BOOST_STATS.filter((s) => b[s]).map(
    (s) => `${b[s] > 0 ? '+' : ''}${b[s]} ${s[0].toUpperCase()}${s.slice(1)}`
  )
  return parts.length ? `${parts.join(' ')} ` : ''
}

// Champions-appropriate label (the library's own desc shows misleading EV text).
function label(set: PokeSet, boosts?: Boosts, tera?: string): string {
  const kit = [set.item, set.ability].filter(Boolean).join(' ')
  const pts = pointsSpent(set.points)
  const teraStr = tera ? ` Tera ${tera}` : ''
  const head = `${boostText(boosts)}${set.nature} ${set.species}${teraStr}`
  return [kit, head].filter(Boolean).join(' ') + (pts ? ` (${pts} pts)` : '')
}

// Damage-calc-only modifiers (Tera/G-max are not part of a saved set).
export interface CalcExtras {
  atkTera?: string
  defTera?: string
  gmax?: boolean
}

export interface SideOpts {
  reflect: boolean
  lightScreen: boolean
  auroraVeil: boolean
  helpingHand: boolean
  friendGuard: boolean
  tailwind: boolean
  protect: boolean
  stealthRock: boolean
  leechSeed: boolean
  spikes: number // 0-3
  switching: boolean
}

export const EMPTY_SIDE: SideOpts = {
  reflect: false,
  lightScreen: false,
  auroraVeil: false,
  helpingHand: false,
  friendGuard: false,
  tailwind: false,
  protect: false,
  stealthRock: false,
  leechSeed: false,
  spikes: 0,
  switching: false
}

export interface FieldOpts {
  gameType: 'Singles' | 'Doubles'
  weather: string
  terrain: string
  gravity: boolean
  magicRoom: boolean
  wonderRoom: boolean
  crit: boolean
  atk: SideOpts // attacker's side
  def: SideOpts // defender's side
}

export const DEFAULT_FIELD: FieldOpts = {
  gameType: 'Doubles',
  weather: '',
  terrain: '',
  gravity: false,
  magicRoom: false,
  wonderRoom: false,
  crit: false,
  atk: { ...EMPTY_SIDE },
  def: { ...EMPTY_SIDE }
}

export interface CalcOutcome {
  minDmg: number
  maxDmg: number
  minPct: number
  maxPct: number
  koText: string
  desc: string
  error?: string
}

/** Build a calc Pokémon, overwriting its stats with Champions-computed values. */
function buildPokemon(set: PokeSet, boosts?: Boosts, tera?: string): CalcPokemon {
  const sp = findSpecies(set.species)
  const natObj = gen.natures.get(set.nature)
  const p = new CalcPokemon(GEN, set.species, {
    level: LEVEL,
    nature: set.nature,
    ability: set.ability || undefined,
    item: set.item || undefined,
    moves: set.moves.filter(Boolean),
    boosts: boosts as never,
    teraType: (tera || undefined) as never, // omit when not terastallized
    // Ensure correct types/base even if calc forme names drift from @pkmn.
    overrides: sp ? { types: sp.types as never, baseStats: { ...sp.baseStats, spc: 0 } as never } : undefined
  })
  if (sp) {
    const stats = computeStats(sp.baseStats, set.points, natObj)
    for (const s of STAT_ORDER) {
      p.rawStats[s] = stats[s]
      p.stats[s] = stats[s]
    }
    p.originalCurHP = stats.hp
  }
  return p
}

export function runCalc(
  attacker: PokeSet,
  defender: PokeSet,
  moveName: string,
  field: FieldOpts,
  atkBoosts?: Boosts,
  defBoosts?: Boosts,
  extras?: CalcExtras
): CalcOutcome {
  const empty: CalcOutcome = {
    minDmg: 0,
    maxDmg: 0,
    minPct: 0,
    maxPct: 0,
    koText: '',
    desc: ''
  }
  if (!attacker.species || !defender.species || !moveName) {
    return { ...empty, error: 'Pick an attacker, defender, and move.' }
  }
  try {
    const atk = buildPokemon(attacker, atkBoosts, extras?.atkTera)
    const def = buildPokemon(defender, defBoosts, extras?.defTera)
    // G-max attacker → use the Max/G-max variant of the move.
    const move = new CalcMove(GEN, moveName, {
      isCrit: field.crit,
      useMax: extras?.gmax || undefined
    } as never)
    const side = (s: SideOpts): Record<string, unknown> => ({
      isReflect: s.reflect,
      isLightScreen: s.lightScreen,
      isAuroraVeil: s.auroraVeil,
      isHelpingHand: s.helpingHand,
      isFriendGuard: s.friendGuard,
      isTailwind: s.tailwind,
      isProtected: s.protect,
      isSR: s.stealthRock,
      isSeeded: s.leechSeed,
      spikes: s.spikes,
      isSwitching: s.switching ? 'out' : undefined
    })
    const f = new Field({
      gameType: field.gameType,
      weather: (field.weather || undefined) as never,
      terrain: (field.terrain || undefined) as never,
      isGravity: field.gravity,
      isMagicRoom: field.magicRoom,
      isWonderRoom: field.wonderRoom,
      attackerSide: side(field.atk) as never,
      defenderSide: side(field.def) as never
    })
    const result = calculate(GEN, atk, def, move, f)

    const [minDmg, maxDmg] = result.range()
    const maxHP = def.maxHP()
    const ko = (() => {
      try {
        return result.kochance().text || ''
      } catch {
        return ''
      }
    })()
    const minPct = Math.round((minDmg / maxHP) * 1000) / 10
    const maxPct = Math.round((maxDmg / maxHP) * 1000) / 10
    const moveLabel = extras?.gmax ? `${moveName} (Max)` : moveName
    const desc =
      `${label(attacker, atkBoosts, extras?.atkTera)} ${moveLabel} vs. ` +
      `${label(defender, defBoosts, extras?.defTera)}: ` +
      `${minDmg}-${maxDmg} (${minPct} - ${maxPct}%)` +
      (ko ? ` — ${ko}` : '')
    return { minDmg, maxDmg, minPct, maxPct, koText: ko, desc }
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : String(e) }
  }
}
