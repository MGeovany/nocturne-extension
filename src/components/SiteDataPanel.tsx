import { useEffect, type ReactNode } from 'react'
import { useSiteData, type StorageEntry } from '../hooks/useSiteData'

function valuePreview(value: string): string {
  if (value.length <= 140) return value
  return `${value.slice(0, 140)}…`
}

function EmptyStorageIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z" />
      <path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
      <path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </svg>
  )
}

function Section({
  title,
  count,
  onClear,
  children,
}: {
  title: string
  count: number
  onClear?: () => void
  children: ReactNode
}) {
  if (count === 0) return null
  return (
    <section className="site-data-section">
      <div className="section-head">
        <h3>{title}</h3>
        <div className="section-tools">
          <span className="meta-chip">{count}</span>
          {onClear && <button onClick={onClear}>Clear</button>}
        </div>
      </div>
      {children}
    </section>
  )
}

function StorageTable({
  rows,
  onDelete,
}: {
  rows: StorageEntry[]
  onDelete: (key: string) => void
}) {
  return (
    <div className="headers-wrap site-data-table-wrap">
      <table className="headers site-data-table">
        <tbody>
          {rows.map((entry) => (
            <tr key={entry.key}>
              <td className="hname">{entry.key}</td>
              <td className="hvalue" title={entry.value}>{valuePreview(entry.value)}</td>
              <td className="site-data-action"><button onClick={() => onDelete(entry.key)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SiteDataPanel() {
  const {
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
  } = useSiteData()

  useEffect(() => {
    refresh()
  }, [refresh])

  const total = data
    ? data.cookies.length +
      data.localStorage.length +
      data.sessionStorage.length +
      data.indexedDB.length +
      data.cacheStorage.length +
      data.serviceWorkers.length
    : 0

  return (
    <div className="detail site-data-panel">
      <div className="detail-header">
        <div className="url-bar">
          <span className="method-pill method-other">SITE DATA</span>
          <span className="url-bar-path" title={data?.href || ''}>{data?.origin || 'Inspected page'}</span>
          <div className="url-bar-meta">
            <span className="meta-chip">{loading ? 'Loading…' : `${total} records`}</span>
          </div>
        </div>
        <div className="tab-bar">
          <div className="tab-bar-tabs">
            <button className="tab active">Storage</button>
          </div>
          <div className="tab-bar-actions">
            <button onClick={refresh} disabled={loading || working}>Refresh</button>
            <button className="danger" onClick={clearAll} disabled={!data || total === 0 || loading || working}>
              Clean slate
            </button>
          </div>
        </div>
      </div>

      <div className="detail-body">
        {error && <div className="site-data-error">{error}</div>}

        {!loading && total === 0 && !error && (
          <div className="empty site-data-empty">
            <div className="empty-icon">
              <EmptyStorageIcon />
            </div>
            <span className="empty-title">No site data</span>
            <span className="empty-hint">Cookies, storage, caches and service workers are already clean.</span>
          </div>
        )}

        {data && total > 0 && (
          <div className="site-data-sections">
            <Section title="Cookies" count={data.cookies.length}>
              <div className="headers-wrap site-data-table-wrap">
                <table className="headers site-data-table">
                  <tbody>
                    {data.cookies.map((cookie) => (
                      <tr key={`${cookie.storeId}:${cookie.domain}:${cookie.path}:${cookie.name}`}>
                        <td className="hname">
                          {cookie.name}
                          {cookie.httpOnly && <span className="badge">HttpOnly</span>}
                          {cookie.secure && <span className="badge">Secure</span>}
                        </td>
                        <td className="hvalue" title={cookie.value}>{valuePreview(cookie.value)}</td>
                        <td className="site-data-meta">{cookie.domain}{cookie.path}</td>
                        <td className="site-data-action"><button onClick={() => deleteCookie(cookie)}>Delete</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="Local Storage" count={data.localStorage.length} onClear={() => clearStorage('localStorage')}>
              <StorageTable rows={data.localStorage} onDelete={(key) => deleteStorageItem('localStorage', key)} />
            </Section>

            <Section title="Session Storage" count={data.sessionStorage.length} onClear={() => clearStorage('sessionStorage')}>
              <StorageTable rows={data.sessionStorage} onDelete={(key) => deleteStorageItem('sessionStorage', key)} />
            </Section>

            <Section title="IndexedDB" count={data.indexedDB.length}>
              <div className="site-data-list">
                {data.indexedDB.map((db) => (
                  <div className="site-data-list-row" key={db.name}>
                    <span className="site-data-name">{db.name}</span>
                    <span className="meta-chip">v{db.version ?? 'unknown'}</span>
                    <button onClick={() => deleteIndexedDB(db.name)}>Delete</button>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Cache Storage" count={data.cacheStorage.length}>
              <div className="site-data-list">
                {data.cacheStorage.map((name) => (
                  <div className="site-data-list-row" key={name}>
                    <span className="site-data-name">{name}</span>
                    <button onClick={() => deleteCache(name)}>Delete</button>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Service Workers" count={data.serviceWorkers.length}>
              <div className="site-data-list">
                {data.serviceWorkers.map((scope) => (
                  <div className="site-data-list-row" key={scope}>
                    <span className="site-data-name">{scope}</span>
                    <button onClick={() => unregisterServiceWorker(scope)}>Unregister</button>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}
      </div>
    </div>
  )
}
