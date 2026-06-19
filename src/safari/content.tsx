// Safari content-script entry. Injects the MAIN-world capture script, relays
// its messages into the store, and mounts the React panel as an isolated overlay.
import { createRoot } from 'react-dom/client'
import { Panel } from '../Panel'
import * as store from './store'
import panelCss from '../styles.css?inline'
import overlayCss from './overlay.css?inline'

const FAB_SIZE = 46
const PANEL_GAP = 58
const VIEWPORT_PAD = 8

// 1. Inject the MAIN-world capture script from the extension's resources.
const s = document.createElement('script')
s.src = chrome.runtime.getURL('inject.js')
s.onload = () => {
  console.log('[404-AM] injected capture script loaded')
  s.remove()
}
;(document.head || document.documentElement).appendChild(s)

// 2. Relay window messages from inject.js into the store.
window.addEventListener('message', (e) => {
  if (e.source !== window) return
  const d = e.data
  if (!d || d.__source !== '404am') return
  console.log('[404-AM] received message', d.kind)
  if (d.kind === 'request') store.addRequest(d.payload)
  else if (d.kind === 'log') store.addLog(d.payload)
  else if (d.kind === 'nav') store.addNavigation(d.payload?.url ?? '')
})

// 3. Mount in Shadow DOM so panel styles cannot affect the inspected page.
function mount() {
  if (document.getElementById('__404am_host')) return

  let side: 'left' | 'right' = 'right'
  let anchorY = window.innerHeight - FAB_SIZE - 16

  const host = document.createElement('div')
  host.id = '__404am_host'
  host.style.position = 'fixed'
  host.style.left = `${window.innerWidth - FAB_SIZE - 16}px`
  host.style.top = `${anchorY}px`
  host.style.right = 'auto'
  host.style.bottom = 'auto'
  host.style.width = '46px'
  host.style.height = '46px'
  host.style.zIndex = '2147483647'
  host.style.pointerEvents = 'auto'
  host.style.overflow = 'visible'
  document.documentElement.appendChild(host)
  const shadow = host.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = overlayCss + '\n' + panelCss.replace(/:root/g, ':host')
  shadow.appendChild(style)

  const button = document.createElement('button')
  button.className = 'overlay-fab'
  button.type = 'button'
  button.title = '404-AM'
  button.setAttribute('aria-label', 'Open 404-AM')
  const buttonIcon = document.createElement('img')
  buttonIcon.src = chrome.runtime.getURL('icons/icon32.png')
  buttonIcon.alt = ''
  buttonIcon.width = 32
  buttonIcon.height = 32
  button.appendChild(buttonIcon)
  shadow.appendChild(button)

  const modeButton = document.createElement('button')
  modeButton.className = 'overlay-mode'
  modeButton.type = 'button'
  modeButton.title = 'Expand panel'
  modeButton.textContent = '↗'
  modeButton.hidden = true
  shadow.appendChild(modeButton)

  const panelEl = document.createElement('div')
  panelEl.className = 'overlay-panel'
  panelEl.hidden = true
  shadow.appendChild(panelEl)

  let open = false
  let expanded = false
  let dragging = false
  let moved = false
  let dragStartX = 0
  let dragStartY = 0
  let anchorStartY = 0

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

  const panelSize = () => ({
    width: Math.min(expanded ? 980 : 520, Math.max(FAB_SIZE, window.innerWidth - VIEWPORT_PAD * 2)),
    height: Math.min(expanded ? 680 : 440, Math.max(FAB_SIZE, window.innerHeight - 96)),
  })

  const hostSize = () => {
    if (!open) return { width: FAB_SIZE, height: FAB_SIZE }
    const panel = panelSize()
    return { width: panel.width, height: panel.height + PANEL_GAP }
  }

  const clampAnchor = () => {
    anchorY = clamp(anchorY, VIEWPORT_PAD, window.innerHeight - FAB_SIZE - VIEWPORT_PAD)
  }

  const positionHost = () => {
    clampAnchor()
    const size = hostSize()
    const left = side === 'left' ? VIEWPORT_PAD : window.innerWidth - size.width - VIEWPORT_PAD
    const top = clamp(anchorY - (size.height - FAB_SIZE), VIEWPORT_PAD, window.innerHeight - size.height - VIEWPORT_PAD)
    host.style.left = `${left}px`
    host.style.top = `${top}px`
    host.style.width = `${size.width}px`
    host.style.height = `${size.height}px`
    host.classList.toggle('left', side === 'left')
    host.classList.toggle('right', side === 'right')
  }

  const syncOpen = () => {
    panelEl.hidden = !open
    modeButton.hidden = !open
    panelEl.classList.toggle('expanded', expanded)
    modeButton.textContent = expanded ? '↙' : '↗'
    modeButton.title = expanded ? 'Compact panel' : 'Expand panel'
    positionHost()
    console.log('[404-AM] overlay open:', open)
  }

  const toggleOpen = () => {
    open = !open
    syncOpen()
  }

  const onDragMove = (event: PointerEvent) => {
    if (!dragging) return
    const dx = event.clientX - dragStartX
    const dy = event.clientY - dragStartY
    if (Math.abs(dx) + Math.abs(dy) > 4) moved = true
    side = event.clientX < window.innerWidth / 2 ? 'left' : 'right'
    anchorY = anchorStartY + dy
    positionHost()
  }

  const onDragEnd = (event: PointerEvent) => {
    event.preventDefault()
    event.stopPropagation()
    dragging = false
    document.removeEventListener('pointermove', onDragMove)
    document.removeEventListener('pointerup', onDragEnd)
    try {
      button.releasePointerCapture(event.pointerId)
    } catch (_err) {
      // Safari can throw if capture was already released by the page.
    }
    if (!moved) {
      toggleOpen()
    } else {
      side = event.clientX < window.innerWidth / 2 ? 'left' : 'right'
      positionHost()
    }
  }

  button.addEventListener('pointerdown', (event) => {
    event.preventDefault()
    event.stopPropagation()
    dragging = true
    moved = false
    dragStartX = event.clientX
    dragStartY = event.clientY
    anchorStartY = anchorY
    try {
      button.setPointerCapture(event.pointerId)
    } catch (_err) {
      // Pointer capture is best-effort in Safari content scripts.
    }
    document.addEventListener('pointermove', onDragMove)
    document.addEventListener('pointerup', onDragEnd)
  })

  modeButton.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    expanded = !expanded
    syncOpen()
  })

  const closeIfOutside = (event: Event) => {
      if (!open) return
      if (event.composedPath().includes(host)) return
      open = false
      syncOpen()
  }

  document.addEventListener('pointerdown', closeIfOutside, true)
  document.addEventListener('mousedown', closeIfOutside, true)
  document.addEventListener('touchstart', closeIfOutside, true)
  window.addEventListener('pointerdown', closeIfOutside, true)
  window.addEventListener('mousedown', closeIfOutside, true)

  window.addEventListener('resize', positionHost)

  createRoot(panelEl).render(<Panel />)
  syncOpen()
  console.log('[404-AM] overlay mounted')
}

if (document.documentElement) mount()
else document.addEventListener('DOMContentLoaded', mount)
