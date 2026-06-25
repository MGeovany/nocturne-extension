import { useCallback, useEffect, useRef, useState } from 'react'
import type { CapturedRequest, HarHeader } from '../types'
import { ignoreExtensionContextInvalidated, isExtensionContextInvalidated } from '../lib/chrome'

const STORAGE_KEY = 'fourohfour_request_history_v1'
const MAX_PERSISTED_REQUESTS = 500
const MAX_PERSISTED_BODY_CHARS = 250_000

type ResponseContent = { content: string; encoding: string }
type PersistedRequest = Omit<CapturedRequest, 'getContent'> & { responseContent?: ResponseContent }

interface PersistedHistory {
  requests: PersistedRequest[]
  navigations: NavMarker[]
}

function toHeaders(list: ReadonlyArray<{ name: string; value: string }>): HarHeader[] {
  return list.map((h) => ({ name: h.name, value: h.value }))
}

function restoreRequest(request: PersistedRequest): CapturedRequest {
  const { responseContent, ...restored } = request
  return {
    ...restored,
    getContent: async () => responseContent ?? { content: '', encoding: '' },
  }
}

function toPersistedRequest(request: CapturedRequest): PersistedRequest {
  const { getContent: _ignored, ...persistable } = request
  return persistable
}

function trimHistory(history: PersistedHistory): PersistedHistory {
  const requests = history.requests.slice(-MAX_PERSISTED_REQUESTS)
  const oldestRequestId = requests[0]?.id ?? Infinity
  return {
    requests,
    navigations: history.navigations.filter((nav) => nav.boundaryId >= oldestRequestId),
  }
}

/** A page navigation that happened while preserving the log. */
export interface NavMarker {
  /** The id the next captured request will receive; the marker renders before it. */
  boundaryId: number
  url: string
}

/**
 * Subscribes to finished network requests for the inspected page and exposes
 * them as a growing list. When `preserveLog` is false, the list is cleared on
 * each navigation (mirroring the Network panel); when true, a navigation
 * marker is recorded instead so history survives page reloads.
 */
export function useNetworkRequests(preserveLog: boolean) {
  const [requests, setRequests] = useState<CapturedRequest[]>([])
  const [navigations, setNavigations] = useState<NavMarker[]>([])
  const idRef = useRef(0)
  const preserveRef = useRef(preserveLog)
  const persistedRef = useRef<PersistedHistory>({ requests: [], navigations: [] })

  useEffect(() => {
    preserveRef.current = preserveLog
  }, [preserveLog])

  useEffect(() => {
    let contextInvalidated = false
    let cleanupListeners = () => {}
    const stopIfContextInvalidated = (error: unknown) => {
      if (!isExtensionContextInvalidated(error)) throw error
      contextInvalidated = true
    }

    const persistHistory = () => {
      try {
        if (typeof chrome === 'undefined') return
        const history = trimHistory(persistedRef.current)
        persistedRef.current = history
        chrome.storage?.local?.set({ [STORAGE_KEY]: history })
      } catch (error) {
        ignoreExtensionContextInvalidated(error)
      }
    }

    const startListening = () => {
      if (contextInvalidated) return

      const onFinished = (entry: chrome.devtools.network.Request) => {
        if (contextInvalidated) return
        const resourceType =
          (entry as unknown as { _resourceType?: string })._resourceType ?? 'other'

        const id = idRef.current++
        const getContent = () =>
          new Promise<ResponseContent>((resolve) => {
            entry.getContent((content, encoding) =>
              resolve({ content: content ?? '', encoding: encoding ?? '' }),
            )
          })

        const captured: CapturedRequest = {
          id,
          method: entry.request.method,
          url: entry.request.url,
          status: entry.response.status,
          statusText: entry.response.statusText,
          resourceType,
          durationMs: Math.round(entry.time),
          startedDateTime: entry.startedDateTime,
          requestHeaders: toHeaders(entry.request.headers),
          responseHeaders: toHeaders(entry.response.headers),
          requestBody: entry.request.postData
            ? {
                mimeType: entry.request.postData.mimeType,
                text: entry.request.postData.text,
              }
            : undefined,
          responseMimeType: entry.response.content?.mimeType ?? '',
          responseBodySize: entry.response.content?.size ?? 0,
          getContent,
        }

        persistedRef.current = {
          ...persistedRef.current,
          requests: [...persistedRef.current.requests, toPersistedRequest(captured)],
        }
        persistHistory()
        setRequests((prev) => [...prev, captured])

        getContent().then((responseContent) => {
          if (contextInvalidated || responseContent.content.length > MAX_PERSISTED_BODY_CHARS) return
          persistedRef.current = {
            ...persistedRef.current,
            requests: persistedRef.current.requests.map((request) =>
              request.id === id ? { ...request, responseContent } : request,
            ),
          }
          persistHistory()
        })
      }

      const onNavigated = (url: string) => {
        if (contextInvalidated) return
        if (preserveRef.current) {
          const marker = { boundaryId: idRef.current, url }
          persistedRef.current = trimHistory({
            ...persistedRef.current,
            navigations: [...persistedRef.current.navigations, marker],
          })
          persistHistory()
          setNavigations((prev) => [...prev, marker])
        } else {
          persistedRef.current = { requests: [], navigations: [] }
          persistHistory()
          setRequests([])
          setNavigations([])
        }
      }

      try {
        chrome.devtools.network.onRequestFinished.addListener(onFinished)
        chrome.devtools.network.onNavigated.addListener(onNavigated)
        cleanupListeners = () => {
          chrome.devtools.network.onRequestFinished.removeListener(onFinished)
          chrome.devtools.network.onNavigated.removeListener(onNavigated)
        }
      } catch (error) {
        stopIfContextInvalidated(error)
      }
    }

    try {
      const storage = typeof chrome === 'undefined' ? undefined : chrome.storage?.local
      if (!storage) {
        startListening()
      } else {
        storage.get(STORAGE_KEY, (res) => {
          if (contextInvalidated) return
          const saved = res?.[STORAGE_KEY] as Partial<PersistedHistory> | undefined
          const restored = {
            requests: Array.isArray(saved?.requests) ? saved.requests : [],
            navigations: Array.isArray(saved?.navigations) ? saved.navigations : [],
          }
          persistedRef.current = trimHistory(restored)
          idRef.current = Math.max(0, ...persistedRef.current.requests.map((request) => request.id + 1))
          setRequests((prev) => (prev.length === 0 ? persistedRef.current.requests.map(restoreRequest) : prev))
          setNavigations((prev) => (prev.length === 0 ? persistedRef.current.navigations : prev))
          startListening()
        })
      }
    } catch (error) {
      stopIfContextInvalidated(error)
      startListening()
    }

    return () => {
      contextInvalidated = true
      try {
        cleanupListeners()
      } catch (error) {
        if (!isExtensionContextInvalidated(error)) throw error
      }
    }
  }, [])

  const clear = useCallback(() => {
    persistedRef.current = { requests: [], navigations: [] }
    try {
      if (typeof chrome !== 'undefined') chrome.storage?.local?.remove(STORAGE_KEY)
    } catch (error) {
      ignoreExtensionContextInvalidated(error)
    }
    setRequests([])
    setNavigations([])
  }, [])

  return { requests, navigations, clear }
}
