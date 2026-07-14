import { Fragment, useMemo, useState } from 'react'
import { useStore, useLegalSpeciesNames } from '../state/store'
import { fetchAllMeta, resolveSpecies, type BattleFormat } from '../data/battleApi'
import { computeStats } from '../data/champions'
import { gen, findSpecies, listItems, STAT_ORDER, STAT_LABEL } from '../data/gen'
import { spriteStyle, itemSpriteStyle } from '../data/sprites'
import { newMeta, correctItemStats, itemExists, type MetaEntry } from '../data/meta'
import SearchSelect from './SearchSelect'

type SortKey = 'rank' | 'species'

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'rank', label: '#' },
  { key: 'species', label: 'Pokémon' }
]

function Detail({ e }: { e: MetaEntry }): JSX.Element {
  const { setItemFix } = useStore()
  const items = useMemo(() => listItems(), [])
  const [editing, setEditing] = useState('')
  const sp = findSpecies(e.species)
  const natObj = gen.natures.get(e.nature)
  const finalsFor = (pts: MetaEntry['points']): Record<string, number> | null =>
    sp ? computeStats(sp.baseStats, pts, natObj) : null

  return (
    <div className="bd-detail-inner">
      <div className="bd-grid2">
        <div className="bd-col">
          <h4 className="meta-sub">Moves</h4>
          <div className="usage-list">
            {e.moveStats.map((m) => (
              <span key={m.name} className="usage-pill">
                {m.name} {m.pct && <b>{m.pct}</b>}
              </span>
            ))}
          </div>
          <h4 className="meta-sub">Items</h4>
          <div className="usage-list">
            {correctItemStats(e.itemStats).map((it, i) => {
              const known = itemExists(it.name)
              return (
                <span key={`${it.name}-${i}`} className={known ? 'usage-pill' : 'usage-pill unknown'}>
                  {known ? (
                    <span className="item-icon" style={itemSpriteStyle(it.name)} />
                  ) : (
                    <span className="unknown-q" title="Unrecognized item">?</span>
                  )}
                  {it.name} {it.pct && <b>{it.pct}</b>}
                  {!known &&
                    (editing === it.name ? (
                      <span className="item-fix">
                        <SearchSelect
                          value=""
                          onChange={(v) => {
                            if (v) setItemFix(it.name, v)
                            setEditing('')
                          }}
                          options={items}
                          placeholder="set correct item…"
                        />
                      </span>
                    ) : (
                      <button className="fix-btn" onClick={() => setEditing(it.name)}>
                        fix
                      </button>
                    ))}
                </span>
              )
            })}
          </div>
        </div>
        <div className="bd-col">
          <h4 className="meta-sub">Abilities</h4>
          <div className="usage-list">
            {e.abilityStats.map((a) => (
              <span key={a.name} className="usage-pill">
                {a.name} {a.pct && <b>{a.pct}</b>}
              </span>
            ))}
          </div>
          <h4 className="meta-sub">Natures</h4>
          <div className="usage-list">
            {e.natureStats.map((n) => (
              <span key={n.name} className="usage-pill">
                {n.name} {n.pct && <b>{n.pct}</b>}
              </span>
            ))}
          </div>
          <h4 className="meta-sub">Common teammates</h4>
          <div className="usage-list">
            {e.teammates.map((raw) => {
              const t = resolveSpecies(raw) ?? raw
              return (
                <span key={raw} className="usage-pill">
                  <span className="sprite" style={spriteStyle(t)} />
                  {t}
                </span>
              )
            })}
          </div>
        </div>
      </div>

      <h4 className="meta-sub">Stat spreads used</h4>
      <div className="spread-list">
        {e.spreadStats.map((sd, i) => {
          const finals = finalsFor(sd.points)
          return (
            <div key={i} className="spread-row">
              {sd.pct && <b className="spread-pct">{sd.pct}</b>}
              <span className="spread-points">
                {STAT_ORDER.filter((s) => sd.points[s] > 0)
                  .map((s) => `${sd.points[s]} ${STAT_LABEL[s]}`)
                  .join(' / ') || 'no investment'}
              </span>
              {finals && (
                <span className="subtle spread-finals">
                  → {STAT_ORDER.map((s) => finals[s]).join('/')}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function BattleData(): JSX.Element {
  const { meta, replaceMeta } = useStore()
  const legalNames = useLegalSpeciesNames()
  const [apiFormat, setApiFormat] = useState<BattleFormat>('Doubles')
  const [fetching, setFetching] = useState(false)
  const [msg, setMsg] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [sortDir, setSortDir] = useState<1 | -1>(1)
  const [expanded, setExpanded] = useState('')

  const entries = useMemo(() => {
    const cmp = (a: MetaEntry, b: MetaEntry): number => {
      const r =
        sortKey === 'rank'
          ? (a.rank || 99999) - (b.rank || 99999)
          : String(a[sortKey]).localeCompare(String(b[sortKey]))
      return r * sortDir
    }
    // Merge over defaults so entries saved before new fields existed don't crash.
    return Object.values(meta)
      .map((e) => ({ ...newMeta(e.species), ...e }))
      .sort(cmp)
  }, [meta, sortKey, sortDir])

  function sortBy(k: SortKey): void {
    if (k === sortKey) setSortDir((d) => (d === 1 ? -1 : 1))
    else {
      setSortKey(k)
      setSortDir(1)
    }
  }

  async function fetchAll(): Promise<void> {
    setFetching(true)
    setMsg('Loading available Pokémon…')
    try {
      const legal = new Set(legalNames)
      const map = await fetchAllMeta(apiFormat, (sp) => legal.has(sp), (done, total) =>
        setMsg(`Fetching ${done}/${total}…`)
      )
      const n = Object.keys(map).length
      if (n === 0) {
        setMsg('No matching legal Pokémon found in the API.')
        return
      }
      replaceMeta(map)
      setMsg(`Loaded ${apiFormat} battle data for ${n} Pokémon.`)
    } catch (err) {
      setMsg(`Fetch failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setFetching(false)
    }
  }

  return (
    <div className="panel full">
      <h2>Battle Data</h2>
      <p className="subtle">
        Live usage statistics from the Champions Battle Data API. Usage rank is automatic. Click a
        column to sort, click a Pokémon to expand its details. This data powers Recommended Teammates
        and the Damage Calc’s top-meta quick-adds.
      </p>

      <div className="format-bar">
        <label className="field small-label">
          <span>Format</span>
          <select
            value={apiFormat}
            onChange={(e) => setApiFormat(e.target.value as BattleFormat)}
            disabled={fetching}
          >
            <option value="Doubles">Doubles</option>
            <option value="Singles">Singles</option>
          </select>
        </label>
        <button className="add-btn" onClick={fetchAll} disabled={fetching}>
          Fetch battle data
        </button>
        {msg && <span className="subtle">{msg}</span>}
      </div>

      {entries.length === 0 ? (
        <p className="subtle">No data yet — click “Fetch battle data”.</p>
      ) : (
        <table className="bd-table">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} className="sortable" onClick={() => sortBy(c.key)}>
                  {c.label}
                  {sortKey === c.key ? (sortDir === 1 ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <Fragment key={e.species}>
                <tr
                  className={expanded === e.species ? 'bd-row open' : 'bd-row'}
                  onClick={() => setExpanded((x) => (x === e.species ? '' : e.species))}
                >
                  <td className="bd-rank">{e.rank || '—'}</td>
                  <td className="tc-name">
                    <span className="sprite" style={spriteStyle(e.species)} />
                    {e.species}
                  </td>
                  <td className="subtle bd-hint">
                    {expanded === e.species ? '▲ hide' : '▼ details'}
                  </td>
                </tr>
                {expanded === e.species && (
                  <tr className="bd-detail">
                    <td colSpan={3}>
                      <Detail e={e} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
