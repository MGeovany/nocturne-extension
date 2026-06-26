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

export interface SiteDataSnapshot {
  href: string
  origin: string
  cookies: chrome.cookies.Cookie[]
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

function evalInInspectedPage<T>(expression: string): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      chrome.devtools.inspectedWindow.eval(expression, (result, exceptionInfo) => {
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
  const token = `__404AM_SITE_DATA_${Date.now()}_${Math.random().toString(36).slice(2)}`
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

function cookieUrl(cookie: chrome.cookies.Cookie): string {
  const protocol = cookie.secure ? 'https:' : 'http:'
  const host = cookie.domain.replace(/^\./, '')
  return `${protocol}//${host}${cookie.path || '/'}`
}

function getCookies(url: string): Promise<chrome.cookies.Cookie[]> {
  return new Promise((resolve, reject) => {
    try {
      if (!chrome.cookies?.getAll) {
        resolve([])
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

function removeCookie(cookie: chrome.cookies.Cookie): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
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
      if (!chrome.browsingData?.remove) {
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

async function readPageData(): Promise<PageData> {
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

  const deleteCookie = useCallback((cookie: chrome.cookies.Cookie) => mutate(() => removeCookie(cookie)), [mutate])

  const deleteStorageItem = useCallback(
    (kind: 'localStorage' | 'sessionStorage', key: string) =>
      mutate(() => evalInInspectedPage<void>(`${kind}.removeItem(${JSON.stringify(key)})`)),
    [mutate],
  )

  const clearStorage = useCallback(
    (kind: 'localStorage' | 'sessionStorage') => mutate(() => evalInInspectedPage<void>(`${kind}.clear()`)),
    [mutate],
  )

  const deleteIndexedDB = useCallback(
    (name: string) => mutate(() => evalAsyncInInspectedPage<void>(`
      await new Promise(function (resolve, reject) {
        var request = indexedDB.deleteDatabase(${JSON.stringify(name)});
        request.onsuccess = function () { resolve(); };
        request.onerror = function () { reject(request.error || new Error('Failed to delete database')); };
        request.onblocked = function () { resolve(); };
      });
    `)),
    [mutate],
  )

  const deleteCache = useCallback(
    (name: string) => mutate(() => evalAsyncInInspectedPage<void>(`
      if (typeof caches !== 'undefined') await caches.delete(${JSON.stringify(name)});
    `)),
    [mutate],
  )

  const unregisterServiceWorker = useCallback(
    (scope: string) => mutate(() => evalAsyncInInspectedPage<void>(`
      if (navigator.serviceWorker) {
        var registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.filter(function (registration) {
          return registration.scope === ${JSON.stringify(scope)};
        }).map(function (registration) { return registration.unregister(); }));
      }
    `)),
    [mutate],
  )

  const clearAll = useCallback(async () => {
    if (!data) return
    await mutate(async () => {
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
