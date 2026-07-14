import { useEffect, useMemo, useRef, useState } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  /** Optional renderer for the label shown in the list (value is still the option string). */
  renderOption?: (option: string) => React.ReactNode
  maxVisible?: number
}

/**
 * A searchable combobox that always shows the full option list (filtered by the
 * typed query), unlike a native <datalist> which filters by the current value.
 */
export default function SearchSelect({
  value,
  onChange,
  options,
  placeholder,
  renderOption,
  maxVisible = 50
}: Props): JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? options.filter((o) => o.toLowerCase().includes(q))
      : options
    return list.slice(0, maxVisible)
  }, [query, options, maxVisible])

  // Close when clicking outside.
  useEffect(() => {
    function onDoc(e: MouseEvent): void {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function choose(opt: string): void {
    onChange(opt)
    setQuery('')
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent): void {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[highlight]) choose(filtered[highlight])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="search-select" ref={rootRef}>
      <input
        value={open ? query : value}
        placeholder={value || placeholder}
        onChange={(e) => {
          setQuery(e.target.value)
          setHighlight(0)
          if (!open) setOpen(true)
        }}
        onFocus={() => {
          setQuery('')
          setOpen(true)
        }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul className="ss-list">
          {filtered.length === 0 && <li className="ss-empty">No matches</li>}
          {filtered.map((opt, i) => (
            <li
              key={opt}
              className={i === highlight ? 'ss-opt active' : 'ss-opt'}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(opt)
              }}
            >
              {renderOption ? renderOption(opt) : opt}
            </li>
          ))}
          {!query && options.length > maxVisible && (
            <li className="ss-more">…type to search {options.length} total</li>
          )}
        </ul>
      )}
    </div>
  )
}
