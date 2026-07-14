import { useMemo, useState } from 'react'
import { listSpecies, listItems } from '../data/gen'
import { useStore } from '../state/store'
import { spriteStyle, itemSpriteStyle } from '../data/sprites'
import { serializeRegulation, parseRegulation } from '../data/regulation'
import { saveTextFile, openTextFile } from '../data/platform'

type View = 'all' | 'legal' | 'banned'
type Mode = 'pokemon' | 'items'

export default function LegalityGrid(): JSX.Element {
  const {
    illegal,
    setIllegal,
    illegalItems,
    setIllegalItems,
    formats,
    activeFormatId,
    selectFormat,
    addFormat,
    addFormatWith,
    renameFormat,
    deleteFormat
  } = useStore()
  const activeFormat = formats.find((f) => f.id === activeFormatId)
  const speciesNames = useMemo(() => listSpecies().map((s) => s.name), [])
  const itemNames = useMemo(() => listItems(), [])

  const [mode, setMode] = useState<Mode>('pokemon')
  const [q, setQ] = useState('')
  const [view, setView] = useState<View>('all')

  const allNames = mode === 'pokemon' ? speciesNames : itemNames
  const banned = mode === 'pokemon' ? illegal : illegalItems
  const setBanned = mode === 'pokemon' ? setIllegal : setIllegalItems
  const bannedSet = useMemo(() => new Set(banned), [banned])
  const iconFor = (name: string): React.CSSProperties =>
    mode === 'pokemon' ? spriteStyle(name) : itemSpriteStyle(name)

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return allNames.filter((n) => {
      if (query && !n.toLowerCase().includes(query)) return false
      const b = bannedSet.has(n)
      if (view === 'legal' && b) return false
      if (view === 'banned' && !b) return false
      return true
    })
  }, [allNames, q, view, bannedSet])

  const legalCount = allNames.length - bannedSet.size

  function toggle(name: string): void {
    const next = new Set(bannedSet)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    setBanned([...next])
  }

  // Export/import a regulation file (legal Pokémon + legal items). Importing
  // creates a new format. Old Pokémon-only files still work (items left open).
  async function exportFile(): Promise<void> {
    const banPok = new Set(illegal)
    const banItem = new Set(illegalItems)
    const text = serializeRegulation(
      speciesNames.filter((n) => !banPok.has(n)),
      itemNames.filter((n) => !banItem.has(n))
    )
    await saveTextFile(`${activeFormat?.name ?? 'regulation'}.txt`, text)
  }
  async function importFile(): Promise<void> {
    const text = await openTextFile()
    if (text == null) return
    const reg = parseRegulation(text)
    const illegalNames = speciesNames.filter((n) => !reg.pokemon.has(n))
    const illegalItemNames = reg.hasItems ? itemNames.filter((n) => !reg.items.has(n)) : []
    addFormatWith('Imported regulation', illegalNames, illegalItemNames)
  }

  return (
    <div className="panel full">
      <h2>Format Legality</h2>
      <p className="subtle">
        Toggle which Pokémon and items are legal in the current format. Legal = highlighted, dimmed =
        banned. Saved automatically.
      </p>

      <div className="format-bar">
        <label className="field small-label">
          <span>Legal list</span>
          <select value={activeFormatId} onChange={(e) => selectFormat(e.target.value)}>
            {formats.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field small-label">
          <span>Rename</span>
          <input
            value={activeFormat?.name ?? ''}
            onChange={(e) => activeFormat && renameFormat(activeFormat.id, e.target.value)}
          />
        </label>
        <button className="add-btn" onClick={() => addFormat(`Format ${formats.length + 1}`, true)}>
          + Save as new list
        </button>
        <button className="add-btn" onClick={() => addFormat(`Format ${formats.length + 1}`, false)}>
          + Blank list
        </button>
        <button
          className="add-btn"
          onClick={() => activeFormat && deleteFormat(activeFormat.id)}
          disabled={formats.length <= 1}
        >
          Delete
        </button>
        <button
          className="add-btn"
          onClick={exportFile}
          title="Export legal Pokémon + items to a .txt regulation file"
        >
          Export regulation
        </button>
        <button
          className="add-btn"
          onClick={importFile}
          title="Import a regulation .txt (Pokémon + items) as a new format. Old Pokémon-only files work too."
        >
          Import regulation
        </button>
      </div>

      <div className="legal-bar">
        <div className="seg">
          {(['pokemon', 'items'] as Mode[]).map((m) => (
            <button
              key={m}
              className={mode === m ? 'seg-btn active' : 'seg-btn'}
              onClick={() => setMode(m)}
            >
              {m === 'pokemon' ? 'Pokémon' : 'Items'}
            </button>
          ))}
        </div>
        <input
          className="legal-search"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="seg">
          {(['all', 'legal', 'banned'] as View[]).map((v) => (
            <button
              key={v}
              className={view === v ? 'seg-btn active' : 'seg-btn'}
              onClick={() => setView(v)}
            >
              {v}
            </button>
          ))}
        </div>
        <button className="add-btn" onClick={() => setBanned([])}>
          All legal
        </button>
        <button className="add-btn" onClick={() => setBanned([...allNames])}>
          Ban all
        </button>
        <button
          className="add-btn"
          onClick={() => setBanned(allNames.filter((n) => !bannedSet.has(n)))}
        >
          Invert
        </button>
        <span className="legal-count">
          {legalCount}/{allNames.length} legal
        </span>
      </div>

      <div className="legal-grid">
        {filtered.map((name) => (
          <button
            key={name}
            className={bannedSet.has(name) ? 'legal-cell banned' : 'legal-cell'}
            onClick={() => toggle(name)}
            title={name}
          >
            <span className={mode === 'pokemon' ? 'sprite' : 'item-icon'} style={iconFor(name)} />
            <span className="cell-name">{name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
