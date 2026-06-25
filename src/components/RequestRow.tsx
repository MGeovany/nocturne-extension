import { useEffect, useRef } from 'react'
import type { CapturedRequest } from '../types'
import { categoryOf, formatBytes } from '../lib/contentType'

export function statusClass(status: number): string {
  if (status === 0) return 'status-pending'
  if (status >= 500) return 'status-5xx'
  if (status >= 400) return 'status-4xx'
  if (status >= 300) return 'status-3xx'
  return 'status-2xx'
}

export function methodClass(method: string): string {
  const m = method.toUpperCase()
  if (m === 'GET') return 'method-get'
  if (m === 'POST') return 'method-post'
  if (m === 'PUT') return 'method-put'
  if (m === 'PATCH') return 'method-patch'
  if (m === 'DELETE') return 'method-delete'
  return 'method-other'
}

function shortPath(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname + u.search
  } catch {
    return url
  }
}

interface Props {
  req: CapturedRequest
  selected: boolean
  onSelect: (id: number) => void
  slowThresholdMs: number
  /** Epoch ms of the earliest visible request (waterfall origin). */
  timelineStart: number
  /** Total visible time span in ms (waterfall scale). */
  timelineSpan: number
  starred: boolean
  onToggleFavorite: (id: number) => void
}

export function RequestRow({
  req,
  selected,
  onSelect,
  slowThresholdMs,
  timelineStart,
  timelineSpan,
  starred,
  onToggleFavorite,
}: Props) {
  const cat = categoryOf(req.responseMimeType)
  const isSlow = slowThresholdMs > 0 && req.durationMs >= slowThresholdMs
  const ref = useRef<HTMLDivElement>(null)

  // Keep the selected row visible (e.g. when moved via keyboard).
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const start = Date.parse(req.startedDateTime)
  const hasTiming = !Number.isNaN(start) && req.durationMs >= 0 && timelineSpan > 0
  const leftPct = hasTiming ? ((start - timelineStart) / timelineSpan) * 100 : 0
  const widthPct = hasTiming ? Math.max((req.durationMs / timelineSpan) * 100, 0.5) : 0

  return (
    <div
      ref={ref}
      data-request-id={req.id}
      className={`request-row ${selected ? 'selected' : ''}`}
      onClick={() => onSelect(req.id)}
      title={req.url}
    >
      <div className="request-row-main">
        <div className="request-row-top">
          <button
            className={`star ${starred ? 'on' : ''}`}
            title={starred ? 'Unstar' : 'Star'}
            onClick={(e) => {
              e.stopPropagation()
              onToggleFavorite(req.id)
            }}
          >
            {starred ? '★' : '☆'}
          </button>
          <span className={`method-pill ${methodClass(req.method)}`}>{req.method}</span>
          <span className="url">
            {isSlow && (
              <span className="slow-badge" title={`Slower than ${slowThresholdMs} ms`}>
                SLOW
              </span>
            )}
            {shortPath(req.url)}
          </span>
        </div>
        <div className="request-row-meta">
          <span className={`status ${statusClass(req.status)}`}>
            {req.status || '···'}
          </span>
          <span className={`duration ${isSlow ? 'slow' : ''}`}>
            {req.durationMs >= 0 ? `${req.durationMs} ms` : '···'}
          </span>
          <span className="size">{formatBytes(req.responseBodySize)}</span>
          <span className={`ctype ctype-${cat}`}>{cat.toUpperCase()}</span>
        </div>
        {hasTiming && (
          <div className="waterfall" title={`Started +${Math.round(start - timelineStart)} ms · ${req.durationMs} ms`}>
            <div
              className={`waterfall-bar ${isSlow ? 'slow' : ''}`}
              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
