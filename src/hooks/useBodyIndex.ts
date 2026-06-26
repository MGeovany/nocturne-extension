import { useEffect, useRef, useState } from 'react'
import type { CapturedRequest } from '../types'

/**
 * Lazily fetches and caches response bodies so the search box can match
 * against body content, not just URLs. Bodies are only fetched while
 * `enabled` is true; results are cached by request id and reused.
 *
 * Returns the cache map plus a `version` counter that increments as bodies
 * arrive — include it in downstream `useMemo` deps to recompute filtering.
 */
export function useBodyIndex(requests: CapturedRequest[], enabled: boolean) {
  const cache = useRef<Map<number, string>>(new Map())
  const inFlight = useRef<Set<number>>(new Set())
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    for (const r of requests) {
      if (r.lifecycleStatus === 'pending') continue
      if (cache.current.has(r.id) || inFlight.current.has(r.id)) continue
      inFlight.current.add(r.id)
      r.getContent().then(({ content }) => {
        if (cancelled) return
        cache.current.set(r.id, (content || '').toLowerCase())
        inFlight.current.delete(r.id)
        setVersion((v) => v + 1)
      })
    }
    return () => {
      cancelled = true
    }
  }, [requests, enabled])

  return { bodies: cache.current, version }
}
