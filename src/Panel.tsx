import { useEffect, useMemo, useRef, useState } from 'react'
import { useRequestSource, useConsoleSource } from '@source'
import { usePersistentFilters } from './hooks/usePersistentFilters'
import { useBodyIndex } from './hooks/useBodyIndex'
import { useHiddenConsoleMessages } from './hooks/useHiddenConsoleMessages'
import { RequestList } from './components/RequestList'
import { RequestDetail } from './components/RequestDetail'
import { SiteDataPanel } from './components/SiteDataPanel'
import { ConsolePanel } from './components/ConsolePanel'
import { Filters, type FilterState } from './components/Filters'
import { downloadFile, toHar, toJson } from './lib/export'
import { categoryOf } from './lib/contentType'
import { ignoreExtensionContextInvalidated } from './lib/chrome'

const API_TYPES = ['xhr', 'fetch']
const LAYOUT_KEY = 'fourohfour_layout_v1'
const DEFAULT_SIDEBAR_WIDTH = 340
const MIN_SIDEBAR = 240
const MAX_SIDEBAR = 720

const DEFAULT_FILTERS: FilterState = {
  search: '',
  onlyErrors: false,
  onlySlow: false,
  slowThresholdMs: 1000,
  hideAssets: false,
  groupByDomain: false,
  contentType: 'all',
  preserveLog: true,
  sort: 'recent',
  searchBodies: false,
  starredOnly: false,
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

export function Panel() {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false)
  const [filters, setFilters] = usePersistentFilters(DEFAULT_FILTERS)
  const [favorites, setFavorites] = useState<Set<number>>(new Set())
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)
  const [consoleCollapsed, setConsoleCollapsed] = useState(false)
  const [workspaceMode, setWorkspaceMode] = useState<'request' | 'site-data'>('request')

  const { requests, navigations, clear } = useRequestSource(filters.preserveLog)
  const { logs, clear: clearLogs } = useConsoleSource(filters.preserveLog)
  const {
    isHidden: isConsoleHidden,
    hide: hideConsoleMessage,
    clear: clearHiddenConsoleMessages,
    hiddenRuleCount,
  } = useHiddenConsoleMessages()

  // Load persisted sidebar width.
  useEffect(() => {
    try {
      if (typeof chrome === 'undefined') return
      chrome.storage?.local?.get(LAYOUT_KEY, (res) => {
        const w = res?.[LAYOUT_KEY]?.sidebarWidth
        if (typeof w === 'number') setSidebarWidth(Math.min(MAX_SIDEBAR, Math.max(MIN_SIDEBAR, w)))
      })
    } catch (error) {
      ignoreExtensionContextInvalidated(error)
    }
  }, [])

  const apiRequests = useMemo(
    () => requests.filter((r) => API_TYPES.includes(r.resourceType)),
    [requests],
  )
  const latestRequestId = apiRequests.length > 0 ? apiRequests[apiRequests.length - 1].id : null

  // Fetch bodies lazily only while body-search is active and there's a query.
  const bodySearchActive = filters.searchBodies && filters.search.trim().length > 0
  const { bodies, version: bodyVersion } = useBodyIndex(apiRequests, bodySearchActive)

  const filtered = useMemo(() => {
    const search = filters.search.toLowerCase()
    return apiRequests.filter((r) => {
      if (filters.onlyErrors && r.status < 400) return false
      if (filters.onlySlow && r.durationMs < filters.slowThresholdMs) return false
      if (filters.starredOnly && !favorites.has(r.id)) return false
      const contentCategory = categoryOf(r.responseMimeType)
      if (filters.hideAssets && ['css', 'image', 'js'].includes(contentCategory)) return false
      if (filters.contentType !== 'all' && contentCategory !== filters.contentType) return false
      if (search) {
        const urlMatch = r.url.toLowerCase().includes(search)
        const bodyMatch = filters.searchBodies && (bodies.get(r.id)?.includes(search) ?? false)
        if (!urlMatch && !bodyMatch) return false
      }
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiRequests, filters, bodyVersion, favorites])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    switch (filters.sort) {
      case 'duration':
        return arr.sort((a, b) => b.durationMs - a.durationMs)
      case 'size':
        return arr.sort((a, b) => b.responseBodySize - a.responseBodySize)
      case 'status':
        return arr.sort((a, b) => b.status - a.status)
      default:
        return arr // 'recent' = capture order
    }
  }, [filtered, filters.sort])

  const visibleLogs = useMemo(() => logs.filter((log) => !isConsoleHidden(log)), [logs, isConsoleHidden])

  // Navigation markers only make sense in chronological, ungrouped order.
  const showMarkers = filters.sort === 'recent' && !filters.groupByDomain

  const selected = apiRequests.find((r) => r.id === selectedId) ?? null

  const toggleFavorite = (id: number) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Keyboard shortcuts: "/" focuses search, ↑/↓ move the selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      if (e.key === '/' && !typing) {
        e.preventDefault()
        document.querySelector<HTMLInputElement>('.search')?.focus()
        return
      }
      if (e.key === 'Escape' && el?.classList.contains('search')) {
        ;(el as HTMLInputElement).blur()
        return
      }
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !typing) {
        if (sorted.length === 0) return
        e.preventDefault()
        const idx = sorted.findIndex((r) => r.id === selectedId)
        let next: number
        if (idx === -1) next = e.key === 'ArrowDown' ? 0 : sorted.length - 1
        else if (e.key === 'ArrowDown') next = Math.min(idx + 1, sorted.length - 1)
        else next = Math.max(idx - 1, 0)
        setSelectedId(sorted[next].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sorted, selectedId])

  const resizingRef = useRef(false)
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    resizingRef.current = true
    document.body.style.cursor = 'col-resize'
    const startX = e.clientX
    const startW = sidebarWidth
    let w = startW
    const onMove = (ev: MouseEvent) => {
      w = Math.min(MAX_SIDEBAR, Math.max(MIN_SIDEBAR, startW + (ev.clientX - startX)))
      setSidebarWidth(w)
    }
    const onUp = () => {
      resizingRef.current = false
      document.body.style.cursor = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      try {
        if (typeof chrome !== 'undefined') chrome.storage?.local?.set({ [LAYOUT_KEY]: { sidebarWidth: w } })
      } catch (error) {
        ignoreExtensionContextInvalidated(error)
      }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const handleClear = () => {
    clear()
    setSelectedId(null)
  }

  const handleExportJson = () => {
    downloadFile(`404-am-${timestamp()}.json`, toJson(filtered), 'application/json')
  }

  const handleExportHar = async () => {
    setExporting(true)
    try {
      const har = await toHar(filtered)
      downloadFile(`404-am-${timestamp()}.har`, har, 'application/json')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="panel">
      <div className="split">
        <aside
          className="sidebar"
          style={{ flex: `0 0 ${sidebarWidth}px`, width: sidebarWidth, maxWidth: 'none' }}
        >
          <Filters
            filters={filters}
            onChange={setFilters}
            total={apiRequests.length}
            shown={filtered.length}
            onClear={handleClear}
            onExportHar={handleExportHar}
            onExportJson={handleExportJson}
            exporting={exporting}
          />
          <div className="sidebar-list">
            <RequestList
              requests={sorted}
              navigations={showMarkers ? navigations : []}
              selectedId={selectedId}
              latestRequestId={latestRequestId}
              onSelect={setSelectedId}
              groupByDomain={filters.groupByDomain}
              slowThresholdMs={filters.slowThresholdMs}
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
            />
          </div>
        </aside>
        <div className="resizer" onMouseDown={startResize} title="Drag to resize" />
        <main className="workspace">
          <div className="workspace-mode-bar">
            <button
              className={`workspace-mode ${workspaceMode === 'request' ? 'active' : ''}`}
              onClick={() => setWorkspaceMode('request')}
            >
              Request
            </button>
            <button
              className={`workspace-mode ${workspaceMode === 'site-data' ? 'active' : ''}`}
              onClick={() => setWorkspaceMode('site-data')}
            >
              Site data
            </button>
          </div>
          {workspaceMode === 'site-data' ? (
            <SiteDataPanel />
          ) : (
            <RequestDetail
              req={selected}
              initialBodyQuery={bodySearchActive ? filters.search : ''}
              consoleLogs={visibleLogs}
            />
          )}
        </main>
      </div>
      <ConsolePanel
        logs={visibleLogs}
        hiddenCount={logs.length - visibleLogs.length}
        hiddenRuleCount={hiddenRuleCount}
        collapsed={consoleCollapsed}
        onToggle={() => setConsoleCollapsed((c) => !c)}
        onClear={clearLogs}
        onHideMessage={hideConsoleMessage}
        onClearHidden={clearHiddenConsoleMessages}
      />
    </div>
  )
}
