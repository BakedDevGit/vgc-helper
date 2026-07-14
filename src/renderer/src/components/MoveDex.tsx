import { useMemo, useState } from 'react'
import { listMoveData, type MoveData } from '../data/gen'

type SortKey = 'name' | 'type' | 'category' | 'power' | 'accuracy' | 'pp'

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Move' },
  { key: 'type', label: 'Type' },
  { key: 'category', label: 'Category' },
  { key: 'power', label: 'Power' },
  { key: 'accuracy', label: 'Acc' },
  { key: 'pp', label: 'PP' }
]

export default function MoveDex(): JSX.Element {
  const all = useMemo(() => listMoveData(), [])
  const [q, setQ] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<1 | -1>(1)

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase()
    const filtered = query
      ? all.filter((m) => m.name.toLowerCase().includes(query) || m.type.toLowerCase().includes(query))
      : all
    const cmp = (a: MoveData, b: MoveData): number => {
      const r =
        typeof a[sortKey] === 'number'
          ? (a[sortKey] as number) - (b[sortKey] as number)
          : String(a[sortKey]).localeCompare(String(b[sortKey]))
      return r * sortDir
    }
    return [...filtered].sort(cmp)
  }, [all, q, sortKey, sortDir])

  function sortBy(k: SortKey): void {
    if (k === sortKey) setSortDir((d) => (d === 1 ? -1 : 1))
    else {
      setSortKey(k)
      setSortDir(1)
    }
  }

  return (
    <div className="panel full">
      <h2>Move Dex</h2>
      <p className="subtle">Every move in the game. Search by name or type, click a header to sort.</p>
      <div className="format-bar">
        <input
          className="legal-search"
          placeholder="Search moves…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="subtle">{rows.length} moves</span>
      </div>
      <table className="bd-table dex-table">
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th key={c.key} className="sortable" onClick={() => sortBy(c.key)}>
                {c.label}
                {sortKey === c.key ? (sortDir === 1 ? ' ▲' : ' ▼') : ''}
              </th>
            ))}
            <th>Effect</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.name}>
              <td className="stat-name">{m.name}</td>
              <td>
                <span className={`type type-${m.type.toLowerCase()}`}>{m.type}</span>
              </td>
              <td className="subtle">{m.category}</td>
              <td>{m.power || '—'}</td>
              <td>{m.accuracy === 0 ? '—' : `${m.accuracy}%`}</td>
              <td className="subtle">{m.pp}</td>
              <td className="subtle dex-desc">{m.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
