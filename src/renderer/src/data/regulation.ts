// A "regulation" text file holds the LEGAL Pokémon and LEGAL items, in two
// sections. Old files (a plain list of Pokémon names, no headers) still parse —
// every line is treated as a Pokémon and items are left unrestricted.
//
//   [Pokemon]
//   Garchomp
//   Whimsicott
//
//   [Items]
//   Life Orb
//   Choice Scarf

export interface ParsedRegulation {
  pokemon: Set<string>
  items: Set<string>
  hasItems: boolean // false for legacy Pokémon-only files
}

export function serializeRegulation(legalPokemon: string[], legalItems: string[]): string {
  return `[Pokemon]\n${legalPokemon.join('\n')}\n\n[Items]\n${legalItems.join('\n')}\n`
}

export function parseRegulation(text: string): ParsedRegulation {
  const pokemon = new Set<string>()
  const items = new Set<string>()
  let section: 'pokemon' | 'items' = 'pokemon'
  let hasItems = false

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const header = line.match(/^\[(.+)\]$/)
    if (header) {
      const s = header[1].toLowerCase()
      if (s.startsWith('item')) {
        section = 'items'
        hasItems = true
      } else if (s.startsWith('pok')) {
        section = 'pokemon'
      }
      continue
    }
    if (section === 'pokemon') pokemon.add(line)
    else items.add(line)
  }
  return { pokemon, items, hasItems }
}
