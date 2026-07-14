import { useMemo, useState } from 'react'
import { listItemData } from '../data/gen'
import { itemSpriteStyle } from '../data/sprites'

export default function ItemDex(): JSX.Element {
  const all = useMemo(() => listItemData(), [])
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase()
    return query
      ? all.filter((it) => it.name.toLowerCase().includes(query) || it.desc.toLowerCase().includes(query))
      : all
  }, [all, q])

  return (
    <div className="panel full">
      <h2>Item Dex</h2>
      <p className="subtle">Every item in the game. Search by name or effect.</p>
      <div className="format-bar">
        <input
          className="legal-search"
          placeholder="Search items…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="subtle">{rows.length} items</span>
      </div>
      <table className="bd-table dex-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Effect</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((it) => (
            <tr key={it.name}>
              <td className="tc-name">
                <span className="item-icon" style={itemSpriteStyle(it.name)} />
                {it.name}
              </td>
              <td className="subtle dex-desc">{it.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
