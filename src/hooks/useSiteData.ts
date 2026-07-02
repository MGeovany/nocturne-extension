import { useCallback, useState } from 'react'
import { ignoreExtensionContextInvalidated } from '../lib/chrome'

export interface StorageEntry {
  key: string
  value: string
}

export interface IndexedDbEntry {
  name: string
  version?: number
}

export interface SiteCookie {
  name: string
  value: string
  domain: string
  path: string
  storeId: string
  httpOnly: boolean
  secure: boolean
}

export interface SiteDataSnapshot {
  href: string
  origin: string
  cookies: SiteCookie[]
  localStorage: StorageEntry[]
  sessionStorage: StorageEntry[]
  indexedDB: IndexedDbEntry[]
  cacheStorage: string[]
  serviceWorkers: string[]
}

interface PageData {
  href: string
  origin: string
  localStorage: StorageEntry[]
  sessionStorage: StorageEntry[]
  indexedDB: IndexedDbEntry[]
  cacheStorage: string[]
  serviceWorkers: string[]
}

interface EvaluationExceptionInfo {
  isException?: boolean
  value?: string
  description?: string
}

type DevtoolsEval = (expression: string, callback: (result: unknown, exceptionInfo?: EvaluationExceptionInfo) => void) => void

function getDevtoolsEval(): DevtoolsEval | undefined {
  const api = globalThis.chrome
  if (!api) return undefined
  const devtools = api['devtools']
  if (!devtools) return undefined
  const inspectedWindow = devtools['inspectedWindow']
  return inspectedWindow?.eval
}

function hasDevtoolsEval(): boolean {
  return !!getDevtoolsEval()
}

function evalInInspectedPage<T>(expression: string): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      if (!hasDevtoolsEval()) {
        reject(new Error('DevTools page evaluation is not available'))
        return
      }
      const devtoolsEval = getDevtoolsEval()
      if (!devtoolsEval) {
        reject(new Error('DevTools page evaluation is not available'))
        return
      }
      devtoolsEval(expression, (result, exceptionInfo) => {
        const lastError = chrome.runtime?.lastError
        if (lastError) {
          reject(new Error(lastError.message))
          return
        }
        if (exceptionInfo?.isException) {
          reject(new Error(exceptionInfo.value || exceptionInfo.description || 'Evaluation failed'))
          return
        }
        resolve(result as T)
      })
    } catch (error) {
      reject(error)
    }
  })
}

async function waitForPageToken<T>(token: string): Promise<T> {
  for (let i = 0; i < 20; i++) {
    const result = await evalInInspectedPage<T | null>(`(function () {
      var value = window[${JSON.stringify(token)}];
      if (!value) return null;
      try { delete window[${JSON.stringify(token)}]; } catch (_) {}
      return value;
    })()`)
    if (result) return result
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error('Timed out reading site data')
}

async function evalAsyncInInspectedPage<T>(body: string): Promise<T> {
  const token = `__nocturne_SITE_DATA_${Date.now()}_${Math.random().toString(36).slice(2)}`
  await evalInInspectedPage<string>(`(function () {
    var token = ${JSON.stringify(token)};
    window[token] = null;
    Promise.resolve().then(async function () {
      ${body}
    }).then(function (value) {
      window[token] = { ok: true, value: value };
    }).catch(function (error) {
      window[token] = { ok: false, error: String(error && error.message || error) };
    });
    return token;
  })()`)

  const result = await waitForPageToken<{ ok: boolean; value?: T; error?: string }>(token)
  if (!result.ok) throw new Error(result.error || 'Page operation failed')
  return result.value as T
}

function storageEntries(storage: Storage): StorageEntry[] {
  try {
    return Object.keys(storage).map((key) => ({ key, value: storage.getItem(key) || '' }))
  } catch (_err) {
    return []
  }
}

function cookieUrl(cookie: SiteCookie): string {
  const protocol = cookie.secure ? 'https:' : 'http:'
  const host = cookie.domain.replace(/^\./, '')
  return `${protocol}//${host}${cookie.path || '/'}`
}

function decodeCookiePart(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch (_err) {
    return value
  }
}

function documentCookies(): SiteCookie[] {
  if (typeof document === 'undefined' || !document.cookie) return []
  return document.cookie
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const eq = part.indexOf('=')
      const rawName = eq === -1 ? part : part.slice(0, eq)
      const rawValue = eq === -1 ? '' : part.slice(eq + 1)
      return {
        name: decodeCookiePart(rawName),
        value: decodeCookiePart(rawValue),
        domain: location.hostname,
        path: '/',
        storeId: 'document',
        httpOnly: false,
        secure: location.protocol === 'https:',
      }
    })
}

function expireDocumentCookie(name: string, path = '/') {
  const encodedName = encodeURIComponent(name)
  document.cookie = `${encodedName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=${path}`
  document.cookie = `${encodedName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=/`
}

function getCookies(url: string): Promise<SiteCookie[]> {
  return new Promise((resolve, reject) => {
    try {
      if (typeof chrome === 'undefined' || !chrome.cookies?.getAll) {
        resolve(documentCookies())
        return
      }
      chrome.cookies.getAll({ url }, (cookies) => {
        const lastError = chrome.runtime?.lastError
        if (lastError) reject(new Error(lastError.message))
        else resolve(cookies)
      })
    } catch (error) {
      reject(error)
    }
  })
}

function removeCookie(cookie: SiteCookie): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      if (typeof chrome === 'undefined' || !chrome.cookies?.remove) {
        expireDocumentCookie(cookie.name, cookie.path)
        resolve()
        return
      }
      chrome.cookies.remove(
        { url: cookieUrl(cookie), name: cookie.name, storeId: cookie.storeId },
        () => {
          const lastError = chrome.runtime?.lastError
          if (lastError) reject(new Error(lastError.message))
          else resolve()
        },
      )
    } catch (error) {
      reject(error)
    }
  })
}

function clearBrowsingData(origin: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      if (typeof chrome === 'undefined' || !chrome.browsingData?.remove) {
        documentCookies().forEach((cookie) => expireDocumentCookie(cookie.name, cookie.path))
        resolve()
        return
      }
      chrome.browsingData.remove(
        { origins: [origin] },
        {
          cacheStorage: true,
          cookies: true,
          fileSystems: true,
          indexedDB: true,
          localStorage: true,
          serviceWorkers: true,
        },
        () => {
          const lastError = chrome.runtime?.lastError
          if (lastError) reject(new Error(lastError.message))
          else resolve()
        },
      )
    } catch (error) {
      reject(error)
    }
  })
}

async function deleteIndexedDbLocal(name: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error || new Error('Failed to delete database'))
    request.onblocked = () => resolve()
  })
}

async function readLocalPageData(): Promise<PageData> {
  const dbs: IndexedDbEntry[] = []
  try {
    if (indexedDB?.databases) {
      const databases = await indexedDB.databases()
      dbs.push(
        ...databases
          .map((db) => ({ name: db.name || '', version: db.version }))
          .filter((db) => !!db.name),
      )
    }
  } catch (_err) {}

  let cacheNames: string[] = []
  try {
    if (typeof caches !== 'undefined') cacheNames = await caches.keys()
  } catch (_err) {}

  let serviceWorkers: string[] = []
  try {
    if (navigator.serviceWorker) {
      serviceWorkers = (await navigator.serviceWorker.getRegistrations()).map((registration) => registration.scope)
    }
  } catch (_err) {}

  return {
    href: location.href,
    origin: location.origin,
    localStorage: storageEntries(localStorage),
    sessionStorage: storageEntries(sessionStorage),
    indexedDB: dbs,
    cacheStorage: cacheNames,
    serviceWorkers,
  }
}

async function readPageData(): Promise<PageData> {
  if (!hasDevtoolsEval()) return readLocalPageData()

  return evalAsyncInInspectedPage<PageData>(`
    function storageEntries(storage) {
      try {
        return Object.keys(storage).map(function (key) {
          return { key: key, value: storage.getItem(key) || '' };
        });
      } catch (_) {
        return [];
      }
    }

    var dbs = [];
    try {
      if (indexedDB && indexedDB.databases) {
        dbs = (await indexedDB.databases()).map(function (db) {
          return { name: db.name || '', version: db.version };
        }).filter(function (db) { return !!db.name; });
      }
    } catch (_) {}

    var cacheNames = [];
    try {
      if (typeof caches !== 'undefined') cacheNames = await caches.keys();
    } catch (_) {}

    var serviceWorkers = [];
    try {
      if (navigator.serviceWorker) {
        serviceWorkers = (await navigator.serviceWorker.getRegistrations()).map(function (registration) {
          return registration.scope;
        });
      }
    } catch (_) {}

    return {
      href: location.href,
      origin: location.origin,
      localStorage: storageEntries(localStorage),
      sessionStorage: storageEntries(sessionStorage),
      indexedDB: dbs,
      cacheStorage: cacheNames,
      serviceWorkers: serviceWorkers
    };
  `)
}

export function useSiteData() {
  const [data, setData] = useState<SiteDataSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async <T,>(task: () => Promise<T>) => {
    try {
      setError(null)
      return await task()
    } catch (err) {
      try {
        ignoreExtensionContextInvalidated(err)
      } catch (unexpected) {
        setError(unexpected instanceof Error ? unexpected.message : String(unexpected))
      }
      return undefined
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    await run(async () => {
      const pageData = await readPageData()
      const cookies = await getCookies(pageData.href)
      setData({ ...pageData, cookies })
    })
    setLoading(false)
  }, [run])

  const mutate = useCallback(async (task: () => Promise<void>) => {
    setWorking(true)
    await run(task)
    setWorking(false)
    await refresh()
  }, [refresh, run])

  const deleteCookie = useCallback((cookie: SiteCookie) => mutate(() => removeCookie(cookie)), [mutate])

  const deleteStorageItem = useCallback(
    (kind: 'localStorage' | 'sessionStorage', key: string) =>
      mutate(() => {
        if (!hasDevtoolsEval()) {
          ;(kind === 'localStorage' ? localStorage : sessionStorage).removeItem(key)
          return Promise.resolve()
        }
        return evalInInspectedPage<void>(`${kind}.removeItem(${JSON.stringify(key)})`)
      }),
    [mutate],
  )

  const clearStorage = useCallback(
    (kind: 'localStorage' | 'sessionStorage') =>
      mutate(() => {
        if (!hasDevtoolsEval()) {
          ;(kind === 'localStorage' ? localStorage : sessionStorage).clear()
          return Promise.resolve()
        }
        return evalInInspectedPage<void>(`${kind}.clear()`)
      }),
    [mutate],
  )

  const deleteIndexedDB = useCallback(
    (name: string) =>
      mutate(() => {
        if (!hasDevtoolsEval()) return deleteIndexedDbLocal(name)
        return evalAsyncInInspectedPage<void>(`
          await new Promise(function (resolve, reject) {
            var request = indexedDB.deleteDatabase(${JSON.stringify(name)});
            request.onsuccess = function () { resolve(); };
            request.onerror = function () { reject(request.error || new Error('Failed to delete database')); };
            request.onblocked = function () { resolve(); };
          });
        `)
      }),
    [mutate],
  )

  const deleteCache = useCallback(
    (name: string) =>
      mutate(async () => {
        if (!hasDevtoolsEval()) {
          if (typeof caches !== 'undefined') await caches.delete(name)
          return
        }
        await evalAsyncInInspectedPage<void>(`
          if (typeof caches !== 'undefined') await caches.delete(${JSON.stringify(name)});
        `)
      }),
    [mutate],
  )

  const unregisterServiceWorker = useCallback(
    (scope: string) =>
      mutate(async () => {
        if (!hasDevtoolsEval()) {
          if (navigator.serviceWorker) {
            const registrations = await navigator.serviceWorker.getRegistrations()
            await Promise.all(
              registrations
                .filter((registration) => registration.scope === scope)
                .map((registration) => registration.unregister()),
            )
          }
          return
        }
        await evalAsyncInInspectedPage<void>(`
          if (navigator.serviceWorker) {
            var registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.filter(function (registration) {
              return registration.scope === ${JSON.stringify(scope)};
            }).map(function (registration) { return registration.unregister(); }));
          }
        `)
      }),
    [mutate],
  )

  const clearAll = useCallback(async () => {
    if (!data) return
    await mutate(async () => {
      if (!hasDevtoolsEval()) {
        try { localStorage.clear() } catch (_err) {}
        try { sessionStorage.clear() } catch (_err) {}
        try {
          if (typeof caches !== 'undefined') {
            await Promise.all((await caches.keys()).map((key) => caches.delete(key)))
          }
        } catch (_err) {}
        try {
          if (indexedDB?.databases) {
            await Promise.all(
              (await indexedDB.databases())
                .filter((db) => !!db.name)
                .map((db) => deleteIndexedDbLocal(db.name || '')),
            )
          }
        } catch (_err) {}
        try {
          if (navigator.serviceWorker) {
            await Promise.all((await navigator.serviceWorker.getRegistrations()).map((registration) => registration.unregister()))
          }
        } catch (_err) {}
        await clearBrowsingData(data.origin)
        return
      }

      await evalAsyncInInspectedPage<void>(`
        try { localStorage.clear(); } catch (_) {}
        try { sessionStorage.clear(); } catch (_) {}
        try {
          if (typeof caches !== 'undefined') {
            await Promise.all((await caches.keys()).map(function (key) { return caches.delete(key); }));
          }
        } catch (_) {}
        try {
          if (indexedDB && indexedDB.databases) {
            await Promise.all((await indexedDB.databases()).filter(function (db) { return !!db.name; }).map(function (db) {
              return new Promise(function (resolve) {
                var request = indexedDB.deleteDatabase(db.name);
                request.onsuccess = request.onerror = request.onblocked = function () { resolve(); };
              });
            }));
          }
        } catch (_) {}
        try {
          if (navigator.serviceWorker) {
            await Promise.all((await navigator.serviceWorker.getRegistrations()).map(function (registration) {
              return registration.unregister();
            }));
          }
        } catch (_) {}
      `)
      await clearBrowsingData(data.origin)
    })
  }, [data, mutate])

  return {
    data,
    loading,
    working,
    error,
    refresh,
    deleteCookie,
    deleteStorageItem,
    clearStorage,
    deleteIndexedDB,
    deleteCache,
    unregisterServiceWorker,
    clearAll,
  }
}
