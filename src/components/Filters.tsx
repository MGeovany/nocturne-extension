import { CATEGORY_LABEL, CONTENT_CATEGORIES } from '../lib/contentType'
import { ignoreExtensionContextInvalidated } from '../lib/chrome'

export type SortMode = 'recent' | 'duration' | 'size' | 'status'

export interface FilterState {
  search: string
  onlyErrors: boolean
  onlySlow: boolean
  slowThresholdMs: number
  hideAssets: boolean
  groupByDomain: boolean
  contentType: string
  preserveLog: boolean
  sort: SortMode
  searchBodies: boolean
  starredOnly: boolean
}

const SORT_LABEL: Record<SortMode, string> = {
  recent: 'Recent',
  duration: 'Slowest',
  size: 'Largest',
  status: 'Status',
}

function extensionIconUrl() {
  try {
    return typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('icons/icon32.png')
      : 'icons/icon32.png'
  } catch (error) {
    ignoreExtensionContextInvalidated(error)
    return 'icons/icon32.png'
  }
}

interface Props {
  filters: FilterState
  onChange: (next: FilterState) => void
  total: number
  shown: number
  onClear: () => void
  onExportHar: () => void
  onExportJson: () => void
  exporting: boolean
}

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" />
    </svg>
  )
}

export function Filters({
  filters,
  onChange,
  total,
  shown,
  onClear,
  onExportHar,
  onExportJson,
  exporting,
}: Props) {
  const iconUrl = extensionIconUrl()
  const toggle = (key: keyof FilterState) => {
    onChange({ ...filters, [key]: !filters[key] })
  }

  return (
    <div className="sidebar-head">
      <div className="sidebar-title-row">
        <div className="brand">
          <img className="brand-icon" src={iconUrl} alt="" width={18} height={18} />
          <span className="brand-name">404-AM</span>
        </div>
        <div className="sidebar-actions">
          <span className="count">{shown}/{total}</span>
          <button
            className="ghost icon-btn"
            title="Export HAR"
            onClick={onExportHar}
            disabled={exporting || shown === 0}
          >
            {exporting ? '…' : 'HAR'}
          </button>
          <button className="ghost icon-btn" title="Export JSON" onClick={onExportJson} disabled={shown === 0}>
            JSON
          </button>
          <button className="ghost icon-btn" title="Clear" onClick={onClear}>
            ✕
          </button>
        </div>
      </div>

      <div className="search-wrap">
        <SearchIcon />
        <input
          className="search"
          placeholder="Filter requests"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />
        {filters.search && (
          <button
            type="button"
            className="search-clear"
            title="Clear search"
            aria-label="Clear search"
            onClick={() => onChange({ ...filters, search: '' })}
          >
            ✕
          </button>
        )}
      </div>

      <div className="filters-row">
        <label className={`chip ${filters.onlyErrors ? 'active' : ''}`}>
          <input type="checkbox" checked={filters.onlyErrors} onChange={() => toggle('onlyErrors')} />
          Errors
        </label>

        <label className={`chip ${filters.starredOnly ? 'active' : ''}`}>
          <input type="checkbox" checked={filters.starredOnly} onChange={() => toggle('starredOnly')} />
          ★ Starred
        </label>

        <label
          className={`chip ${filters.hideAssets ? 'active' : ''}`}
          title="Hide CSS, image, and JavaScript requests"
        >
          <input type="checkbox" checked={filters.hideAssets} onChange={() => toggle('hideAssets')} />
          No assets
        </label>

        <label className={`threshold-wrap ${filters.onlySlow ? 'active' : ''}`}>
          <input type="checkbox" checked={filters.onlySlow} onChange={() => toggle('onlySlow')} />
          Slow
          <input
            className="threshold"
            type="number"
            min={0}
            step={100}
            value={filters.slowThresholdMs}
            onChange={(e) =>
              onChange({ ...filters, slowThresholdMs: Number(e.target.value) || 0 })
            }
          />
          ms
        </label>

        <select
          className="ctype-filter"
          value={filters.contentType}
          onChange={(e) => onChange({ ...filters, contentType: e.target.value })}
        >
          <option value="all">Any type</option>
          {CONTENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>

        <label className={`chip ${filters.groupByDomain ? 'active' : ''}`}>
          <input type="checkbox" checked={filters.groupByDomain} onChange={() => toggle('groupByDomain')} />
          Domain
        </label>

        <label className={`chip ${filters.preserveLog ? 'active' : ''}`}>
          <input type="checkbox" checked={filters.preserveLog} onChange={() => toggle('preserveLog')} />
          History
        </label>

        <label
          className={`chip ${filters.searchBodies ? 'active' : ''}`}
          title="Also match the search text inside response bodies"
        >
          <input type="checkbox" checked={filters.searchBodies} onChange={() => toggle('searchBodies')} />
          Bodies
        </label>

        <select
          className="ctype-filter"
          title="Sort requests"
          value={filters.sort}
          onChange={(e) => onChange({ ...filters, sort: e.target.value as SortMode })}
        >
          {(Object.keys(SORT_LABEL) as SortMode[]).map((s) => (
            <option key={s} value={s}>
              {SORT_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
