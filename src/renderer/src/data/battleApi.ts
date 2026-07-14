import { Dex } from '@pkmn/dex'
import { newMeta, correctItemStats, type MetaEntry, type MetaMap, type UsageStat } from './meta'
import { isElectron, apiFetchJson, apiFetchText } from './platform'

// Champions Battle Data API — https://championsbattledata.com/api_guide
// The `/api` index lists every Pokémon with a per-format CSV path. The CSVs hold
// the only correct per-FORME data, but the static CSV files send NO CORS headers,
// so a browser can't read them directly. So the data source depends on platform:
//   - Electron: fetch the CSVs in the main process (no CORS) — full data.
//   - Web with a same-origin proxy (Netlify _redirects, vite proxy, …): fetch the
//     CSVs through `/cbd/…` — full data, formes included.
//   - Web with no proxy: fall back to the CORS-enabled JSON endpoint
//     `/api/battle/:format/:name`. It only returns correct data for BASE species;
//     multi-word formes collapse to their base, so we detect and skip those.
export const API_BASE = 'https://championsbattledata.com'

// Same-origin path prefix a host can map to API_BASE (see public/_redirects and
// the vite proxy config). Keeps requests CORS-free and cacheable by the SW.
const PROXY_PREFIX = '/cbd'

export type BattleFormat = 'Doubles' | 'Singles'

// Web data strategy, resolved once on the first index load.
let webMode: 'proxy' | 'direct' | null = null

interface BattleRow {
  category: string
  rank: number
  name: string
  percentage: string
  column_position?: number // the Pokémon's overall usage rank in this format
  hp_points?: number
  attack_points?: number
  defense_points?: number
  sp_atk_points?: number
  sp_def_points?: number
  speed_points?: number
}

interface IndexEntry {
  name: string
  battleName: string
  battleDataCsvs?: { season: string; format: string; path: string }[]
}

// Map an API name ("Alolan Ninetales", "Basculegion Male") to our dex name.
export function resolveSpecies(apiName: string): string | undefined {
  const direct = Dex.species.get(apiName)
  if (direct.exists) return direct.name
  const s = apiName
    .replace(/^Alolan (.+)$/, '$1-Alola')
    .replace(/^Galarian (.+)$/, '$1-Galar')
    .replace(/^Hisuian (.+)$/, '$1-Hisui')
    .replace(/^Paldean (.+?) (Combat|Blaze|Aqua) Breed$/, '$1-Paldea-$2')
    .replace(/ (Shield|Blade) Forme$/, '')
    .replace(/ (Dusk|Midnight|Dawn) Form$/, (m) => '-' + m.trim().split(' ')[0])
    .replace(/^Basculegion Male$/, 'Basculegion')
    .replace(/^Basculegion Female$/, 'Basculegion-F')
    .replace(/^Rotom (Heat|Wash|Frost|Fan|Mow)$/, 'Rotom-$1')
    .replace(/ (Female)$/, '-F')
    .replace(/ (Male)$/, '-M')
    .replace(/ Zero Form$/, '')
    .replace(/ (Jumbo|Large|Small) Variety$/, '')
    .replace(/ Fancy Pattern$/, '-Fancy')
  const sp = Dex.species.get(s)
  return sp.exists ? sp.name : undefined
}

let _index: IndexEntry[] | null = null
export async function loadIndex(force = false): Promise<IndexEntry[]> {
  if (_index && !force) return _index
  let data: { pokemon?: IndexEntry[] }
  if (isElectron()) {
    data = (await apiFetchJson(`${API_BASE}/api`)) as { pokemon?: IndexEntry[] }
  } else {
    // Web: prefer a same-origin proxy (full per-forme CSVs). Probe it via the
    // index request itself; if it isn't configured, fall back to direct CORS.
    try {
      const res = await fetch(`${PROXY_PREFIX}/api`)
      const ct = res.headers.get('content-type') ?? ''
      if (!res.ok || !ct.includes('json')) throw new Error('no proxy')
      data = (await res.json()) as { pokemon?: IndexEntry[] }
      webMode = 'proxy'
    } catch {
      webMode = 'direct'
      data = (await apiFetchJson(`${API_BASE}/api`)) as { pokemon?: IndexEntry[] }
    }
  }
  _index = data.pokemon ?? []
  return _index
}

function parseCsv(text: string): BattleRow[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const header = lines[0].split(',')
  const col = (k: string): number => header.indexOf(k)
  const ci = col('category')
  const ri = col('rank')
  const ni = col('name')
  const pi = col('percentage')
  const cpi = col('column_position')
  const pcols: [keyof BattleRow, number][] = [
    ['hp_points', col('hp_points')],
    ['attack_points', col('attack_points')],
    ['defense_points', col('defense_points')],
    ['sp_atk_points', col('sp_atk_points')],
    ['sp_def_points', col('sp_def_points')],
    ['speed_points', col('speed_points')]
  ]
  const rows: BattleRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',')
    if (c.length < header.length || !c[ci]) continue
    const row: BattleRow = {
      category: c[ci],
      rank: Number(c[ri]) || 0,
      name: c[ni] ?? '',
      percentage: c[pi] ?? '',
      column_position: cpi >= 0 ? Number(c[cpi]) || 0 : 0
    }
    for (const [key, idx] of pcols) {
      if (idx >= 0 && c[idx] !== '') (row as unknown as Record<string, number>)[key] = Number(c[idx])
    }
    rows.push(row)
  }
  return rows
}

function rowsToMeta(species: string, rows: BattleRow[]): MetaEntry {
  const rank = rows[0]?.column_position ?? 0 // automated usage rank
  const byCat = (cat: string): BattleRow[] =>
    rows.filter((r) => r.category === cat).sort((a, b) => a.rank - b.rank)
  const stats = (cat: string): UsageStat[] =>
    byCat(cat).map((r) => ({ name: r.name, pct: r.percentage })).filter((s) => s.name)

  const moveStats = stats('move')
  const itemStats = correctItemStats(stats('held_item'))
  const abilityStats = stats('ability')
  const natureStats = stats('stat_alignment')
  const teammates = byCat('teammate')
    .map((r) => (r.name ? resolveSpecies(r.name) ?? r.name : ''))
    .filter(Boolean)

  const toSpread = (r: BattleRow): { hp: number; atk: number; def: number; spa: number; spd: number; spe: number } => ({
    hp: r.hp_points ?? 0,
    atk: r.attack_points ?? 0,
    def: r.defense_points ?? 0,
    spa: r.sp_atk_points ?? 0,
    spd: r.sp_def_points ?? 0,
    spe: r.speed_points ?? 0
  })
  const spreadRows = byCat('stat_points')
  const spreadStats = spreadRows.map((r) => ({ points: toSpread(r), pct: r.percentage }))
  const points = spreadRows[0] ? toSpread(spreadRows[0]) : newMeta(species).points

  return {
    ...newMeta(species),
    rank,
    item: itemStats[0]?.name ?? '',
    ability: abilityStats[0]?.name ?? '',
    nature: natureStats[0]?.name ?? '',
    points,
    moves: moveStats.map((m) => m.name),
    teammates,
    moveStats,
    itemStats,
    abilityStats,
    natureStats,
    spreadStats
  }
}

interface Target {
  path: string
  species: string
  battleName: string
}

// The JSON battle endpoint returns the same rows as the CSV (already parsed).
function rowsFromJson(rows: Record<string, unknown>[]): BattleRow[] {
  const num = (v: unknown): number | undefined =>
    v === '' || v == null ? undefined : Number(v)
  return rows
    .filter((r) => r && r.category)
    .map((r) => ({
      category: String(r.category),
      rank: Number(r.rank) || 0,
      name: r.name != null ? String(r.name) : '',
      percentage: r.percentage != null ? String(r.percentage) : '',
      column_position: Number(r.column_position) || 0,
      hp_points: num(r.hp_points),
      attack_points: num(r.attack_points),
      defense_points: num(r.defense_points),
      sp_atk_points: num(r.sp_atk_points),
      sp_def_points: num(r.sp_def_points),
      speed_points: num(r.speed_points)
    }))
}

const normName = (s: string | undefined): string => (s ?? '').trim().toLowerCase()

async function fetchTarget(t: Target, format: BattleFormat): Promise<MetaEntry> {
  // Direct web mode: CORS JSON endpoint. Correct only for base species — if the
  // server collapsed a forme to its base, the returned name won't match; skip it
  // rather than show wrong data.
  if (!isElectron() && webMode === 'direct') {
    const j = (await apiFetchJson(
      `${API_BASE}/api/battle/${format}/${encodeURIComponent(t.battleName)}`
    )) as { pokemon?: string; rows?: Record<string, unknown>[] }
    if (!j.rows || normName(j.pokemon) !== normName(t.battleName)) {
      throw new Error(`no direct data for ${t.battleName}`)
    }
    return rowsToMeta(t.species, rowsFromJson(j.rows))
  }
  // Electron (main process) or web-proxy mode: read the real per-forme CSV.
  const base = !isElectron() && webMode === 'proxy' ? PROXY_PREFIX : API_BASE
  const text = await apiFetchText(`${base}/${encodeURI(t.path)}`)
  return rowsToMeta(t.species, parseCsv(text))
}

/** Index entries with a CSV for `format`, resolved to our dex names. */
async function targetsForFormat(format: BattleFormat): Promise<Target[]> {
  const index = await loadIndex()
  const out: Target[] = []
  for (const e of index) {
    const csv = (e.battleDataCsvs ?? []).find((c) => c.format === format)
    if (!csv) continue
    const species = resolveSpecies(e.battleName)
    if (species) out.push({ path: csv.path, species, battleName: e.battleName })
  }
  return out
}

/** Fetch every available Pokémon for a format that passes `isLegal`, keyed by dex name. */
export async function fetchAllMeta(
  format: BattleFormat,
  isLegal: (species: string) => boolean,
  onProgress: (done: number, total: number) => void
): Promise<MetaMap> {
  const targets = (await targetsForFormat(format)).filter((t) => isLegal(t.species))
  const map: MetaMap = {}
  let done = 0
  let idx = 0
  const CONCURRENCY = 8

  async function worker(): Promise<void> {
    while (idx < targets.length) {
      const t = targets[idx++]
      try {
        map[t.species] = await fetchTarget(t, format)
      } catch {
        /* skip mons whose fetch fails (e.g. formes unavailable in direct web mode) */
      }
      onProgress(++done, targets.length)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))
  return map
}
