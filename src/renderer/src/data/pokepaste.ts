import { STAT_ORDER, STAT_LABEL, findSpecies, type StatID } from './gen'
import { newSet, PER_STAT_CAP, type PokeSet } from './champions'

// Champions has no IVs and uses a 66-point spread; we map those points onto the
// PokePaste "EVs:" line (same structure) so teams round-trip and stay shareable.

const LABEL_TO_STAT: Record<string, StatID> = {
  hp: 'hp', atk: 'atk', def: 'def', spa: 'spa', spd: 'spd', spe: 'spe'
}

export function setToPokepaste(s: PokeSet): string {
  if (!s.species) return ''
  const lines: string[] = []
  lines.push(s.item ? `${s.species} @ ${s.item}` : s.species)
  if (s.ability) lines.push(`Ability: ${s.ability}`)
  lines.push('Level: 50')
  const evs = STAT_ORDER.filter((st) => s.points[st] > 0).map(
    (st) => `${s.points[st]} ${STAT_LABEL[st]}`
  )
  if (evs.length) lines.push(`EVs: ${evs.join(' / ')}`)
  if (s.nature) lines.push(`${s.nature} Nature`)
  for (const m of s.moves) if (m) lines.push(`- ${m}`)
  return lines.join('\n')
}

export function teamToPokepaste(sets: PokeSet[]): string {
  return sets.map(setToPokepaste).filter(Boolean).join('\n\n')
}

function parseEVs(body: string, points: PokeSet['points']): void {
  for (const part of body.split('/')) {
    const m = part.trim().match(/^(\d+)\s+(HP|Atk|Def|SpA|SpD|Spe)$/i)
    if (!m) continue
    const stat = LABEL_TO_STAT[m[2].toLowerCase()]
    if (stat) points[stat] = Math.max(0, Math.min(PER_STAT_CAP, parseInt(m[1], 10)))
  }
}

function parseBlock(block: string): PokeSet | null {
  const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return null

  const set = newSet()
  const moves: string[] = []

  // First line: "Nickname (Species) (Gender) @ Item"
  let first = lines[0]
  const at = first.indexOf(' @ ')
  if (at >= 0) {
    set.item = first.slice(at + 3).trim()
    first = first.slice(0, at).trim()
  }
  first = first.replace(/\s*\((?:M|F)\)\s*$/i, '').trim() // drop gender
  const nick = first.match(/^.*\(([^)]+)\)\s*$/) // species inside parens if nicknamed
  set.species = (nick ? nick[1] : first).trim()

  for (const line of lines.slice(1)) {
    if (/^ability:/i.test(line)) set.ability = line.slice(line.indexOf(':') + 1).trim()
    else if (/^evs:/i.test(line)) parseEVs(line.slice(line.indexOf(':') + 1), set.points)
    else if (/nature$/i.test(line)) set.nature = line.replace(/\s*nature$/i, '').trim()
    else if (/^-/.test(line)) {
      const mv = line
        .slice(1)
        .split('/')[0]
        .replace(/\[(.*?)\]/, '$1') // Hidden Power [Fire] -> Hidden Power Fire
        .trim()
      if (mv) moves.push(mv)
    }
    // IVs / Level / Shiny / Happiness / Tera Type are ignored (Champions: lvl 50, perfect IVs)
  }

  set.moves = [moves[0] ?? '', moves[1] ?? '', moves[2] ?? '', moves[3] ?? '']
  // Default the ability for single-ability mons that omit the line.
  if (!set.ability) set.ability = findSpecies(set.species)?.abilities[0] ?? ''
  return set
}

export function pokepasteToTeam(text: string): PokeSet[] {
  return text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map(parseBlock)
    .filter((s): s is PokeSet => !!s)
}

// Always return exactly 6 slots for the teambuilder UI.
export function normalizeTeam(sets: PokeSet[]): PokeSet[] {
  const out = sets.slice(0, 6)
  while (out.length < 6) out.push(newSet())
  return out
}
