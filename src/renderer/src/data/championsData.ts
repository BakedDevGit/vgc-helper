import { apiFetchJson } from './platform'

// Live Champions data corrections, fetched at launch from a JSON file in the repo
// so small fixes (a move's accuracy, a new learnset entry) ship by editing ONE
// file on GitHub — no app rebuild, and every platform (desktop/web/Android) picks
// it up. Built-in defaults below keep the app correct offline and on first launch;
// the remote file merges on top, so it only needs to carry corrections.

export interface MovePatch {
  type?: string
  category?: string
  power?: number
  accuracy?: number
  pp?: number
  priority?: number
  desc?: string
}

export interface ChampionsOverrides {
  moveOverrides: Record<string, MovePatch>
  learnsetAdditions: Record<string, string[]>
}

const BUILTIN: ChampionsOverrides = {
  moveOverrides: {
    'Make It Rain': { accuracy: 95, desc: "Lowers the user's Sp. Atk by 2. Hits foe(s)." }
  },
  learnsetAdditions: {
    Swampert: ['Wave Crash']
  }
}

// Edit this file on GitHub (web UI, no rebuild) to push data fixes to every app.
const REMOTE_URL =
  'https://raw.githubusercontent.com/BakedDevGit/vgc-helper/main/champions-overrides.json'
const CACHE_KEY = 'champions-overrides-cache'

function merge(remote: Partial<ChampionsOverrides> | null): ChampionsOverrides {
  return {
    moveOverrides: { ...BUILTIN.moveOverrides, ...(remote?.moveOverrides ?? {}) },
    learnsetAdditions: { ...BUILTIN.learnsetAdditions, ...(remote?.learnsetAdditions ?? {}) }
  }
}

function loadCache(): Partial<ChampionsOverrides> | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Partial<ChampionsOverrides>) : null
  } catch {
    return null
  }
}

// Applied synchronously at module load (BUILTIN + last cached remote) so the very
// first render already has the corrections, even offline.
let active: ChampionsOverrides = merge(loadCache())
let version = 0
const listeners = new Set<() => void>()

export const getMoveOverrides = (): Record<string, MovePatch> => active.moveOverrides
export const getLearnsetAdditions = (): Record<string, string[]> => active.learnsetAdditions
/** Bumps whenever the live overrides change — use as a React dependency. */
export const overridesVersion = (): number => version

export function onOverridesChanged(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** Fetch the live overrides once on startup; applies + caches them if changed. */
export async function refreshChampionsOverrides(): Promise<void> {
  let remote: Partial<ChampionsOverrides>
  try {
    remote = (await apiFetchJson(`${REMOTE_URL}?t=${Date.now()}`)) as Partial<ChampionsOverrides>
  } catch {
    return // offline / file not published yet — keep built-in + cached
  }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(remote))
  } catch {
    /* private mode / quota */
  }
  const next = merge(remote)
  if (JSON.stringify(next) !== JSON.stringify(active)) {
    active = next
    version++
    listeners.forEach((cb) => cb())
  }
}
