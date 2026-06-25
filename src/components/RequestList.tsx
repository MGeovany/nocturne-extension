import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { CapturedRequest } from '../types'
import type { NavMarker } from '../hooks/useNetworkRequests'
import { RequestRow } from './RequestRow'

interface Props {
  requests: CapturedRequest[]
  navigations: NavMarker[]
  selectedId: number | null
  latestRequestId: number | null
  onSelect: (id: number) => void
  groupByDomain: boolean
  slowThresholdMs: number
  favorites: Set<number>
  onToggleFavorite: (id: number) => void
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return 'unknown'
  }
}

function EmptyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 7h16M4 12h10M4 17h6" />
    </svg>
  )
}

function NavMarkerRow({ url }: { url: string }) {
  let label = url
  try {
    label = new URL(url).pathname || url
  } catch {
    /* keep raw url */
  }

  return (
    <div className="nav-marker" title={url}>
      Navigated to {label}
    </div>
  )
}

export function RequestList({
  requests,
  navigations,
  selectedId,
  latestRequestId,
  onSelect,
  groupByDomain,
  slowThresholdMs,
  favorites,
  onToggleFavorite,
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const listRef = useRef<HTMLDivElement>(null)
  const previousLatestRequestIdRef = useRef(latestRequestId)

  useEffect(() => {
    if (latestRequestId !== null && latestRequestId !== previousLatestRequestIdRef.current) {
      listRef.current
        ?.querySelector<HTMLElement>(`[data-request-id="${latestRequestId}"]`)
        ?.scrollIntoView({ block: 'end' })
    }
    previousLatestRequestIdRef.current = latestRequestId
  }, [latestRequestId])

  if (requests.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">
          <EmptyIcon />
        </div>
        <span className="empty-title">No requests</span>
        <span className="empty-hint">Trigger fetch or XHR on the page</span>
      </div>
    )
  }

  // Shared waterfall bounds across all visible requests.
  let timelineStart = Infinity
  let timelineEnd = -Infinity
  for (const r of requests) {
    const s = Date.parse(r.startedDateTime)
    if (Number.isNaN(s)) continue
    timelineStart = Math.min(timelineStart, s)
    timelineEnd = Math.max(timelineEnd, s + Math.max(r.durationMs, 0))
  }
  if (!Number.isFinite(timelineStart)) timelineStart = 0
  const timelineSpan = Math.max(timelineEnd - timelineStart, 1)

  const row = (r: CapturedRequest) => (
    <RequestRow
      key={r.id}
      req={r}
      selected={r.id === selectedId}
      onSelect={onSelect}
      slowThresholdMs={slowThresholdMs}
      timelineStart={timelineStart}
      timelineSpan={timelineSpan}
      starred={favorites.has(r.id)}
      onToggleFavorite={onToggleFavorite}
    />
  )

  if (!groupByDomain) {
    const navs = [...navigations].sort((a, b) => a.boundaryId - b.boundaryId)
    const items: ReactNode[] = []
    let mi = 0
    for (const r of requests) {
      while (mi < navs.length && navs[mi].boundaryId <= r.id) {
        items.push(<NavMarkerRow key={`nav-${mi}`} url={navs[mi].url} />)
        mi++
      }
      items.push(row(r))
    }
    while (mi < navs.length) {
      items.push(<NavMarkerRow key={`nav-${mi}`} url={navs[mi].url} />)
      mi++
    }
    return <div ref={listRef} className="request-list">{items}</div>
  }

  const groups = new Map<string, CapturedRequest[]>()
  for (const r of requests) {
    const host = hostOf(r.url)
    const list = groups.get(host)
    if (list) list.push(r)
    else groups.set(host, [r])
  }

  const toggle = (host: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(host) ? next.delete(host) : next.add(host)
      return next
    })
  }

  return (
    <div ref={listRef} className="request-list">
      {[...groups.entries()].map(([host, list]) => {
        const isCollapsed = collapsed.has(host)
        return (
          <div key={host} className="group">
            <div className="group-header" onClick={() => toggle(host)}>
              <span className="caret">{isCollapsed ? '▸' : '▾'}</span>
              <span className="group-host">{host}</span>
              <span className="group-count">{list.length}</span>
            </div>
            {!isCollapsed && list.map(row)}
          </div>
        )
      })}
    </div>
  )
}
