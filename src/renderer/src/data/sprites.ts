import { Icons } from '@pkmn/img'
import type { CSSProperties } from 'react'

// @pkmn/img returns a CSS string; convert it to a React style object.
function cssToObj(css: string): CSSProperties {
  const obj: Record<string, string> = {}
  for (const decl of css.split(';')) {
    const i = decl.indexOf(':')
    if (i < 0) continue
    const key = decl
      .slice(0, i)
      .trim()
      .replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
    obj[key] = decl.slice(i + 1).trim()
  }
  return obj as CSSProperties
}

export function spriteStyle(name: string): CSSProperties {
  try {
    return cssToObj(Icons.getPokemon(name).style)
  } catch {
    return {}
  }
}

export function itemSpriteStyle(name: string): CSSProperties {
  if (!name) return { display: 'none' }
  try {
    return cssToObj(Icons.getItem(name).style)
  } catch {
    return { display: 'none' }
  }
}
