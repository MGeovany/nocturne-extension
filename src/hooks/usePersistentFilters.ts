import { useEffect, useRef, useState } from 'react'
import type { FilterState } from '../components/Filters'
import { ignoreExtensionContextInvalidated } from '../lib/chrome'

const STORAGE_KEY = 'fourohfour_filters_v1'

/**
 * Filter state backed by chrome.storage.local so preferences (toggles,
 * thresholds, sort, content-type) survive DevTools reopens. The transient
 * `search` text is intentionally not persisted.
 */
export function usePersistentFilters(defaults: FilterState) {
  const [filters, setFilters] = useState<FilterState>(defaults)
  const loaded = useRef(false)

  // Load once on mount.
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      loaded.current = true
      return
    }
    try {
      chrome.storage.local.get(STORAGE_KEY, (res) => {
        const saved = res?.[STORAGE_KEY] as Partial<FilterState> | undefined
        if (saved) setFilters((prev) => ({ ...prev, ...saved, search: '' }))
        loaded.current = true
      })
    } catch (error) {
      loaded.current = true
      ignoreExtensionContextInvalidated(error)
    }
  }, [])

  // Persist on change (after the initial load, so defaults don't clobber).
  useEffect(() => {
    if (!loaded.current) return
    const { search: _ignored, ...persistable } = filters
    try {
      if (typeof chrome !== 'undefined') chrome.storage?.local?.set({ [STORAGE_KEY]: persistable })
    } catch (error) {
      ignoreExtensionContextInvalidated(error)
    }
  }, [filters])

  return [filters, setFilters] as const
}
