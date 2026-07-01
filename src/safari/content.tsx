// Safari content-script entry. Injects the MAIN-world capture script, relays
// its messages into the store, and mounts the React panel as an isolated overlay.
import { createRoot } from 'react-dom/client'
import { Panel } from '../Panel'
import * as store from './store'
import panelCss from '../styles.css?inline'
import overlayCss from './overlay.css?inline'

const FAB_SIZE = 46
const PANEL_GAP = 12
const VIEWPORT_PAD = 8
const MODE_SIZE = 34

type Edge = 'left' | 'right' | 'top' | 'bottom'

// 1. Inject the MAIN-world capture script from the extension's resources.
const s = document.createElement('script')
s.src = chrome.runtime.getURL('inject.js')
s.onload = () => {
  console.log('[Nocturne] injected capture script loaded')
  s.remove()
}
;(document.head || document.documentElement).appendChild(s)

// 2. Relay window messages from inject.js into the store.
window.addEventListener('message', (e) => {
  if (e.source !== window) return
  const d = e.data
  if (!d || d.__source !== 'nocturne') return
  console.log('[Nocturne] received message', d.kind)
  if (d.kind === 'request') store.addRequest(d.payload)
  else if (d.kind === 'log') store.addLog(d.payload)
  else if (d.kind === 'nav') store.addNavigation(d.payload?.url ?? '')
})

// 3. Mount in Shadow DOM so panel styles cannot affect the inspected page.
function mount() {
  if (document.getElementById('__nocturne_host')) return

  let edge: Edge = 'right'
  let fabX = window.innerWidth - FAB_SIZE - 16
  let fabY = window.innerHeight - FAB_SIZE - 16

  const host = document.createElement('div')
  host.id = '__nocturne_host'
  host.style.position = 'fixed'
  host.style.left = `${fabX}px`
  host.style.top = `${fabY}px`
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
  button.title = 'Nocturne'
  button.setAttribute('aria-label', 'Open Nocturne')
  const buttonIcon = document.createElement('img')
  buttonIcon.src = chrome.runtime.getURL('icons/icon64.png')
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
  let fabStartX = 0
  let fabStartY = 0
  let snapTimer = 0

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

  const panelSize = () => ({
    width: Math.min(expanded ? 980 : 520, Math.max(FAB_SIZE, window.innerWidth - VIEWPORT_PAD * 2)),
    height: Math.min(expanded ? 680 : 440, Math.max(FAB_SIZE, window.innerHeight - 96)),
  })

  const clampFab = () => {
    fabX = clamp(fabX, VIEWPORT_PAD, window.innerWidth - FAB_SIZE - VIEWPORT_PAD)
    fabY = clamp(fabY, VIEWPORT_PAD, window.innerHeight - FAB_SIZE - VIEWPORT_PAD)
  }

  const snapToNearestEdge = () => {
    clampFab()
    const centerX = fabX + FAB_SIZE / 2
    const centerY = fabY + FAB_SIZE / 2
    const distances: Record<Edge, number> = {
      left: centerX,
      right: window.innerWidth - centerX,
      top: centerY,
      bottom: window.innerHeight - centerY,
    }
    edge = (Object.keys(distances) as Edge[]).reduce((best, next) =>
      distances[next] < distances[best] ? next : best,
    )
    if (edge === 'left') fabX = VIEWPORT_PAD
    else if (edge === 'right') fabX = window.innerWidth - FAB_SIZE - VIEWPORT_PAD
    else if (edge === 'top') fabY = VIEWPORT_PAD
    else fabY = window.innerHeight - FAB_SIZE - VIEWPORT_PAD
    clampFab()
  }

  const positionHost = () => {
    clampFab()
    const panel = panelSize()
    let width = FAB_SIZE
    let height = FAB_SIZE
    let left = fabX
    let top = fabY
    let buttonX = 0
    let buttonY = 0
    let panelX = 0
    let panelY = 0

    if (open) {
      if (edge === 'left' || edge === 'right') {
        width = panel.width + PANEL_GAP + FAB_SIZE
        height = Math.max(panel.height, FAB_SIZE)
        top = clamp(fabY + FAB_SIZE / 2 - height / 2, VIEWPORT_PAD, window.innerHeight - height - VIEWPORT_PAD)
        if (edge === 'left') {
          left = VIEWPORT_PAD
          buttonX = 0
          panelX = FAB_SIZE + PANEL_GAP
        } else {
          left = window.innerWidth - width - VIEWPORT_PAD
          buttonX = width - FAB_SIZE
          panelX = 0
        }
        buttonY = clamp(fabY - top, 0, height - FAB_SIZE)
        panelY = clamp(buttonY + FAB_SIZE / 2 - panel.height / 2, 0, height - panel.height)
      } else {
        width = Math.max(panel.width, FAB_SIZE)
        height = panel.height + PANEL_GAP + FAB_SIZE
        left = clamp(fabX + FAB_SIZE / 2 - width / 2, VIEWPORT_PAD, window.innerWidth - width - VIEWPORT_PAD)
        if (edge === 'top') {
          top = VIEWPORT_PAD
          buttonY = 0
          panelY = FAB_SIZE + PANEL_GAP
        } else {
          top = window.innerHeight - height - VIEWPORT_PAD
          buttonY = height - FAB_SIZE
          panelY = 0
        }
        buttonX = clamp(fabX - left, 0, width - FAB_SIZE)
        panelX = clamp(buttonX + FAB_SIZE / 2 - panel.width / 2, 0, width - panel.width)
      }
    }

    host.style.left = `${left}px`
    host.style.top = `${top}px`
    host.style.width = `${width}px`
    host.style.height = `${height}px`
    host.classList.toggle('edge-left', edge === 'left')
    host.classList.toggle('edge-right', edge === 'right')
    host.classList.toggle('edge-top', edge === 'top')
    host.classList.toggle('edge-bottom', edge === 'bottom')
    button.style.left = `${buttonX}px`
    button.style.top = `${buttonY}px`
    panelEl.style.left = `${panelX}px`
    panelEl.style.top = `${panelY}px`
    panelEl.style.width = `${panel.width}px`
    panelEl.style.height = `${panel.height}px`
    let modeX = buttonX
    let modeY = buttonY
    if (edge === 'left' || edge === 'right') {
      modeX = buttonX + 6
      modeY = buttonY >= MODE_SIZE + 12 ? buttonY - MODE_SIZE - 8 : buttonY + FAB_SIZE + 8
    } else {
      modeX = buttonX >= MODE_SIZE + 12 ? buttonX - MODE_SIZE - 8 : buttonX + FAB_SIZE + 8
      modeY = buttonY + 6
    }
    modeButton.style.left = `${clamp(modeX, 0, width - MODE_SIZE)}px`
    modeButton.style.top = `${clamp(modeY, 0, height - MODE_SIZE)}px`
  }

  const animateSnap = () => {
    window.clearTimeout(snapTimer)
    host.classList.add('snapping')
    positionHost()
    snapTimer = window.setTimeout(() => host.classList.remove('snapping'), 200)
  }

  const syncOpen = () => {
    panelEl.hidden = !open
    modeButton.hidden = !open
    panelEl.classList.toggle('expanded', expanded)
    modeButton.textContent = expanded ? '↙' : '↗'
    modeButton.title = expanded ? 'Compact panel' : 'Expand panel'
    positionHost()
    console.log('[Nocturne] overlay open:', open)
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
    fabX = fabStartX + dx
    fabY = fabStartY + dy
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
      snapToNearestEdge()
      animateSnap()
    }
  }

  button.addEventListener('pointerdown', (event) => {
    event.preventDefault()
    event.stopPropagation()
    dragging = true
    moved = false
    window.clearTimeout(snapTimer)
    host.classList.remove('snapping')
    dragStartX = event.clientX
    dragStartY = event.clientY
    fabStartX = fabX
    fabStartY = fabY
    try {
      button.setPointerCapture(event.pointerId)
    } catch (_err) {
      // Pointer capture is best-effort in Safari content scripts.
    }
    if (!open) document.addEventListener('pointermove', onDragMove)
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
  console.log('[Nocturne] overlay mounted')
}

if (document.documentElement) mount()
else document.addEventListener('DOMContentLoaded', mount)
