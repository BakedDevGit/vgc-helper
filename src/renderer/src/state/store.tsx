import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction
} from 'react'
import { newSet, type PokeSet } from '../data/champions'
import { type MetaEntry, type MetaMap, setUserItemFixes } from '../data/meta'
import { listSpecies, listItems } from '../data/gen'
import { loadState, saveState } from '../data/platform'
import { refreshChampionsOverrides, onOverridesChanged } from '../data/championsData'

export interface LegalFormat {
  id: string
  name: string
  illegal: string[] // species banned in this format
  illegalItems?: string[] // items banned in this format
}

export interface SavedTeam {
  id: string
  name: string
  sets: PokeSet[]
}

// Gameplan: per-matchup team-preview plan for the current team. `picks` maps a
// team member's set.id to its role ('bring' = one of the 4 brought; 'lead' = also
// one of the 2 leads, so leads ⊆ bring).
export interface Matchup {
  id: string
  label: string
  picks: Record<string, 'bring' | 'lead'>
  notes: string
}
export interface Gameplan {
  notes: string // overall win conditions / general plan
  matchups: Matchup[]
}
const emptyGameplan = (): Gameplan => ({ notes: '', matchups: [] })

const genId = (): string => Math.random().toString(36).slice(2, 10)
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))

interface AppState {
  team: PokeSet[]
  benchmarks: PokeSet[]
  meta: MetaMap
  formats: LegalFormat[]
  activeFormatId: string
  savedTeams: SavedTeam[]
  itemFixes: Record<string, string>
  gameplan: Gameplan
  illegal?: string[] // legacy single-list field (migrated to formats)
}

interface Ctx {
  ready: boolean
  dataVersion: number // bumps when live Champions overrides change
  team: PokeSet[]
  benchmarks: PokeSet[]
  meta: MetaMap
  formats: LegalFormat[]
  activeFormatId: string
  illegal: string[] // banned species in the active format
  illegalItems: string[] // banned items in the active format
  savedTeams: SavedTeam[]
  updateTeam: (sets: PokeSet[]) => void
  updateBenchmarks: (sets: PokeSet[]) => void
  updateSet: (which: 'team' | 'benchmarks', set: PokeSet) => void
  upsertMeta: (entry: MetaEntry) => void
  removeMeta: (species: string) => void
  importMeta: (map: MetaMap) => void
  replaceMeta: (map: MetaMap) => void
  setIllegal: (names: string[]) => void
  setIllegalItems: (names: string[]) => void
  selectFormat: (id: string) => void
  addFormat: (name: string, copyActive?: boolean) => void
  addFormatWith: (name: string, illegal: string[], illegalItems?: string[]) => void
  renameFormat: (id: string, name: string) => void
  deleteFormat: (id: string) => void
  saveTeamAs: (name: string) => string
  overwriteSavedTeam: (id: string) => void
  loadSavedTeam: (id: string) => void
  deleteSavedTeam: (id: string) => void
  gameplan: Gameplan
  setGameplan: Dispatch<SetStateAction<Gameplan>>
  itemFixes: Record<string, string>
  setItemFix: (raw: string, corrected: string) => void
}

const StoreContext = createContext<Ctx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }): JSX.Element {
  const [team, setTeam] = useState<PokeSet[]>([])
  const [benchmarks, setBenchmarks] = useState<PokeSet[]>([])
  const [meta, setMeta] = useState<MetaMap>({})
  const [formats, setFormats] = useState<LegalFormat[]>([])
  const [activeFormatId, setActiveFormatId] = useState('')
  const [savedTeams, setSavedTeams] = useState<SavedTeam[]>([])
  const [itemFixes, setItemFixes] = useState<Record<string, string>>({})
  const [gameplan, setGameplan] = useState<Gameplan>(emptyGameplan)
  const [ready, setReady] = useState(false)
  const [dataVersion, setDataVersion] = useState(0)
  const loaded = useRef(false)

  // Fetch live Champions data corrections once on startup; re-render consumers if
  // they changed (built-in/cached values already applied synchronously).
  useEffect(() => {
    const off = onOverridesChanged(() => setDataVersion((v) => v + 1))
    void refreshChampionsOverrides()
    return off
  }, [])

  useEffect(() => {
    const init = (s: Partial<AppState>): void => {
      setTeam(s.team?.length ? s.team : Array.from({ length: 6 }, () => newSet()))
      setBenchmarks(s.benchmarks ?? [])
      setMeta(s.meta ?? {})
      setItemFixes(s.itemFixes ?? {})
      setUserItemFixes(s.itemFixes ?? {})
      // Migrate a legacy single `illegal` list into a named format.
      let fmts = s.formats
      if (!fmts || fmts.length === 0) {
        fmts = [{ id: genId(), name: 'Format 1', illegal: s.illegal ?? [] }]
      }
      setFormats(fmts)
      setActiveFormatId(
        s.activeFormatId && fmts.some((f) => f.id === s.activeFormatId)
          ? s.activeFormatId
          : fmts[0].id
      )
      setSavedTeams(s.savedTeams ?? [])
      setGameplan(s.gameplan ?? emptyGameplan())
      loaded.current = true
      setReady(true)
    }
    loadState()
      .then((s) => init(s as Partial<AppState>))
      .catch(() => init({}))
  }, [])

  useEffect(() => {
    if (loaded.current) {
      saveState({
        team,
        benchmarks,
        meta,
        formats,
        activeFormatId,
        savedTeams,
        itemFixes,
        gameplan
      })
    }
  }, [team, benchmarks, meta, formats, activeFormatId, savedTeams, itemFixes, gameplan])

  const setItemFix = useCallback((raw: string, corrected: string) => {
    setItemFixes((prev) => {
      const next = { ...prev, [raw]: corrected }
      setUserItemFixes(next)
      return next
    })
  }, [])

  const updateTeam = useCallback((sets: PokeSet[]) => setTeam(sets), [])
  const updateBenchmarks = useCallback((sets: PokeSet[]) => setBenchmarks(sets), [])

  const updateSet = useCallback((which: 'team' | 'benchmarks', set: PokeSet) => {
    const apply = (prev: PokeSet[]): PokeSet[] =>
      prev.map((p) => (p.id === set.id ? set : p))
    if (which === 'team') setTeam(apply)
    else setBenchmarks(apply)
  }, [])

  const upsertMeta = useCallback((entry: MetaEntry) => {
    setMeta((prev) => ({ ...prev, [entry.species]: entry }))
  }, [])
  const removeMeta = useCallback((species: string) => {
    setMeta((prev) => {
      const next = { ...prev }
      delete next[species]
      return next
    })
  }, [])
  const importMeta = useCallback((map: MetaMap) => {
    setMeta((prev) => ({ ...prev, ...map }))
  }, [])
  const replaceMeta = useCallback((map: MetaMap) => setMeta(map), [])

  const setIllegal = useCallback(
    (names: string[]) => {
      setFormats((prev) =>
        prev.map((f) => (f.id === activeFormatId ? { ...f, illegal: names } : f))
      )
    },
    [activeFormatId]
  )
  const setIllegalItems = useCallback(
    (names: string[]) => {
      setFormats((prev) =>
        prev.map((f) => (f.id === activeFormatId ? { ...f, illegalItems: names } : f))
      )
    },
    [activeFormatId]
  )
  const selectFormat = useCallback((id: string) => setActiveFormatId(id), [])
  const addFormat = useCallback(
    (name: string, copyActive = false) => {
      const id = genId()
      setFormats((prev) => {
        const src = prev.find((f) => f.id === activeFormatId)
        const illegal = copyActive && src ? [...src.illegal] : []
        return [...prev, { id, name: name.trim() || `Format ${prev.length + 1}`, illegal }]
      })
      setActiveFormatId(id)
    },
    [activeFormatId]
  )
  const addFormatWith = useCallback(
    (name: string, illegal: string[], illegalItems: string[] = []) => {
      const id = genId()
      setFormats((prev) => [
        ...prev,
        { id, name: name.trim() || `Imported ${prev.length + 1}`, illegal, illegalItems }
      ])
      setActiveFormatId(id)
    },
    []
  )
  const renameFormat = useCallback((id: string, name: string) => {
    setFormats((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)))
  }, [])
  const deleteFormat = useCallback((id: string) => {
    setFormats((prev) => {
      if (prev.length <= 1) return prev // keep at least one
      const next = prev.filter((f) => f.id !== id)
      setActiveFormatId((cur) => (cur === id ? next[0].id : cur))
      return next
    })
  }, [])

  const saveTeamAs = useCallback(
    (name: string): string => {
      const id = genId()
      setSavedTeams((prev) => [
        ...prev,
        { id, name: name.trim() || `Team ${prev.length + 1}`, sets: clone(team) }
      ])
      return id
    },
    [team]
  )
  const overwriteSavedTeam = useCallback(
    (id: string) => {
      setSavedTeams((prev) => prev.map((t) => (t.id === id ? { ...t, sets: clone(team) } : t)))
    },
    [team]
  )
  const loadSavedTeam = useCallback(
    (id: string) => {
      setSavedTeams((prev) => {
        const t = prev.find((x) => x.id === id)
        if (t) setTeam(clone(t.sets))
        return prev
      })
    },
    []
  )
  const deleteSavedTeam = useCallback((id: string) => {
    setSavedTeams((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const activeFmt = formats.find((f) => f.id === activeFormatId)
  const illegal = activeFmt?.illegal ?? []
  const illegalItems = activeFmt?.illegalItems ?? []

  return (
    <StoreContext.Provider
      value={{
        ready,
        dataVersion,
        team,
        benchmarks,
        meta,
        formats,
        activeFormatId,
        illegal,
        illegalItems,
        savedTeams,
        updateTeam,
        updateBenchmarks,
        updateSet,
        upsertMeta,
        removeMeta,
        importMeta,
        replaceMeta,
        setIllegal,
        setIllegalItems,
        selectFormat,
        addFormat,
        addFormatWith,
        renameFormat,
        deleteFormat,
        saveTeamAs,
        overwriteSavedTeam,
        loadSavedTeam,
        deleteSavedTeam,
        gameplan,
        setGameplan,
        itemFixes,
        setItemFix
      }}
    >
      {children}
    </StoreContext.Provider>
  )
}

export function useStore(): Ctx {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

/** Species names that are legal in the active format (banned ones excluded). */
export function useLegalSpeciesNames(): string[] {
  const { illegal } = useStore()
  return useMemo(() => {
    const banned = new Set(illegal)
    return listSpecies()
      .filter((s) => !banned.has(s.name))
      .map((s) => s.name)
  }, [illegal])
}

/** Item names that are legal in the active format (banned ones excluded). */
export function useLegalItems(): string[] {
  const { illegalItems } = useStore()
  return useMemo(() => {
    const banned = new Set(illegalItems)
    return listItems().filter((n) => !banned.has(n))
  }, [illegalItems])
}
