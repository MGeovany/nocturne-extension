// In-memory store fed by the content script (which relays window messages
// from inject.js). The injected data-source hooks subscribe to it.
import type { CapturedRequest } from '../types'
import type { NavMarker } from '../hooks/useNetworkRequests'
import type { ConsoleEntry } from '../hooks/useConsoleLogs'

interface RawRequest {
  requestKey?: string
  lifecycleStatus?: CapturedRequest['lifecycleStatus']
  method: string
  url: string
  status: number
  statusText: string
  resourceType: string
  durationMs: number
  startedDateTime: string
  requestHeaders: { name: string; value: string }[]
  responseHeaders: { name: string; value: string }[]
  requestBody?: { mimeType: string; text?: string }
  responseMimeType: string
  responseBodySize: number
  responseBody: string
  responseEncoding: string
}

type Listener = () => void

let requests: CapturedRequest[] = []
let navigations: NavMarker[] = []
let logs: ConsoleEntry[] = []
let preserve = true
let reqId = 0
let logId = 0
const requestKeys = new Map<string, number>()

const listeners = new Set<Listener>()
function emit() {
  listeners.forEach((l) => l())
}

export function subscribe(l: Listener): () => void {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export const getRequests = () => requests
export const getNavigations = () => navigations
export const getLogs = () => logs

export function setPreserve(p: boolean) {
  preserve = p
}

export function clearRequests() {
  requests = []
  navigations = []
  requestKeys.clear()
  emit()
}

export function clearLogs() {
  logs = []
  emit()
}

export function addRequest(raw: RawRequest) {
  const existingId = raw.requestKey ? requestKeys.get(raw.requestKey) : undefined
  const id = existingId ?? reqId++
  const captured: CapturedRequest = {
    id,
    lifecycleStatus: raw.lifecycleStatus ?? 'completed',
    method: raw.method,
    url: raw.url,
    status: raw.status,
    statusText: raw.statusText,
    resourceType: raw.resourceType,
    durationMs: raw.durationMs,
    startedDateTime: raw.startedDateTime,
    requestHeaders: raw.requestHeaders,
    responseHeaders: raw.responseHeaders,
    requestBody: raw.requestBody,
    responseMimeType: raw.responseMimeType,
    responseBodySize: raw.responseBodySize,
    getContent: () =>
      Promise.resolve({ content: raw.responseBody ?? '', encoding: raw.responseEncoding ?? '' }),
  }
  if (raw.requestKey) requestKeys.set(raw.requestKey, id)
  requests = existingId === undefined
    ? requests.concat(captured)
    : requests.map((request) => (request.id === existingId ? captured : request))
  emit()
}

export function addLog(raw: { level: ConsoleEntry['level']; text: string; time: number }) {
  logs = logs.concat({ id: logId++, level: raw.level, text: raw.text, time: raw.time })
  if (logs.length > 5000) logs = logs.slice(logs.length - 5000)
  emit()
}

export function addNavigation(url: string) {
  if (preserve) {
    navigations = navigations.concat({ boundaryId: reqId, url })
    emit()
  } else {
    requests = []
    navigations = []
    logs = []
    requestKeys.clear()
    emit()
  }
}
