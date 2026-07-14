import { useState } from 'react'
import { type FieldOpts, type SideOpts } from '../data/calc'

function Seg({
  options,
  value,
  onChange
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
}): JSX.Element {
  return (
    <div className="fb-seg">
      {options.map((o) => (
        <button
          key={o}
          className={o === value ? 'fb-seg-btn active' : 'fb-seg-btn'}
          onClick={() => onChange(o)}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

function Toggle({
  label,
  active,
  onClick
}: {
  label: string
  active: boolean
  onClick: () => void
}): JSX.Element {
  return (
    <button className={active ? 'fb-btn active' : 'fb-btn'} onClick={onClick}>
      {label}
    </button>
  )
}

type BoolKey = {
  [K in keyof SideOpts]: SideOpts[K] extends boolean ? K : never
}[keyof SideOpts]

function SideCol({
  title,
  side,
  onChange
}: {
  title: string
  side: SideOpts
  onChange: (s: SideOpts) => void
}): JSX.Element {
  const T = (key: BoolKey, label: string): JSX.Element => (
    <Toggle label={label} active={side[key]} onClick={() => onChange({ ...side, [key]: !side[key] })} />
  )
  return (
    <div className="fb-side">
      <div className="fb-side-title">{title}</div>
      <div className="fb-grid">
        {T('reflect', 'Reflect')}
        {T('lightScreen', 'Light Screen')}
        {T('auroraVeil', 'Aurora Veil')}
        {T('helpingHand', 'Helping Hand')}
        {T('friendGuard', 'Friend Guard')}
        {T('tailwind', 'Tailwind')}
        {T('protect', 'Protect')}
        {T('leechSeed', 'Leech Seed')}
        {T('stealthRock', 'Stealth Rock')}
        {T('switching', 'Switching Out')}
      </div>
      <div className="fb-row">
        <span className="fb-label">Spikes</span>
        <Seg
          options={['0', '1', '2', '3']}
          value={String(side.spikes)}
          onChange={(v) => onChange({ ...side, spikes: Number(v) })}
        />
      </div>
    </div>
  )
}

interface Props {
  field: FieldOpts
  onChange: (f: FieldOpts) => void
}

export default function FieldPanel({ field, onChange }: Props): JSX.Element {
  const [open, setOpen] = useState(true)
  const set = (p: Partial<FieldOpts>): void => onChange({ ...field, ...p })

  return (
    <div className="field-panel">
      <button className="fb-header" onClick={() => setOpen((o) => !o)}>
        Field &amp; Side Conditions {open ? '▾' : '▸'}
      </button>
      {open && (
        <div className="fb-body">
          <div className="fb-global">
            <div className="fb-row">
              <span className="fb-label">Format</span>
              <Seg
                options={['Singles', 'Doubles']}
                value={field.gameType}
                onChange={(v) => set({ gameType: v as 'Singles' | 'Doubles' })}
              />
            </div>
            <div className="fb-row">
              <span className="fb-label">Terrain</span>
              <Seg
                options={['None', 'Electric', 'Grassy', 'Misty', 'Psychic']}
                value={field.terrain || 'None'}
                onChange={(v) => set({ terrain: v === 'None' ? '' : v })}
              />
            </div>
            <div className="fb-row">
              <span className="fb-label">Weather</span>
              <Seg
                options={['None', 'Sun', 'Rain', 'Sand', 'Snow']}
                value={field.weather || 'None'}
                onChange={(v) => set({ weather: v === 'None' ? '' : v })}
              />
            </div>
            <div className="fb-row">
              <Toggle label="Magic Room" active={field.magicRoom} onClick={() => set({ magicRoom: !field.magicRoom })} />
              <Toggle label="Wonder Room" active={field.wonderRoom} onClick={() => set({ wonderRoom: !field.wonderRoom })} />
              <Toggle label="Gravity" active={field.gravity} onClick={() => set({ gravity: !field.gravity })} />
              <Toggle label="Critical Hit" active={field.crit} onClick={() => set({ crit: !field.crit })} />
            </div>
          </div>

          <div className="fb-sides">
            <SideCol title="Attacker side" side={field.atk} onChange={(s) => set({ atk: s })} />
            <SideCol title="Defender side" side={field.def} onChange={(s) => set({ def: s })} />
          </div>
        </div>
      )}
    </div>
  )
}
