// Safari content-script entry. Injects the MAIN-world capture script, relays
// its messages into the store, and mounts the React panel as a Shadow-DOM
// overlay (a floating button toggles it).
import { createRoot } from 'react-dom/client'
import { Panel } from '../Panel'
import * as store from './store'
import panelCss from '../styles.css?inline'
import overlayCss from './overlay.css?inline'

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

// 3. Mount in a Shadow DOM so page styles and our styles stay isolated.
function mount() {
  if (document.getElementById('__404am_host')) return
  const host = document.createElement('div')
  host.id = '__404am_host'
  host.style.position = 'fixed'
  host.style.right = '16px'
  host.style.bottom = '16px'
  host.style.width = '46px'
  host.style.height = '46px'
  host.style.zIndex = '2147483647'
  host.style.pointerEvents = 'auto'
  document.documentElement.appendChild(host)
  const shadow = host.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  // The panel stylesheet defines tokens on :root, which does not match inside
  // a shadow root — rewrite to :host so the variables cascade in.
  style.textContent = overlayCss + '\n' + panelCss.replace(/:root/g, ':host')
  shadow.appendChild(style)

  const button = document.createElement('button')
  button.className = 'overlay-fab'
  button.type = 'button'
  button.title = '404-AM'
  button.textContent = '404'
  shadow.appendChild(button)

  const panelEl = document.createElement('div')
  panelEl.className = 'overlay-panel'
  panelEl.hidden = true
  shadow.appendChild(panelEl)

  let open = false
  const syncOpen = () => {
    panelEl.hidden = !open
    host.style.width = open ? 'min(960px, 92vw)' : '46px'
    host.style.height = open ? 'calc(min(620px, 80vh) + 74px)' : '46px'
    console.log('[404-AM] overlay open:', open)
  }

  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    console.log('[404-AM] overlay toggle clicked')
    open = !open
    syncOpen()
  })

  createRoot(panelEl).render(<Panel />)
  syncOpen()
  console.log('[404-AM] overlay mounted')
}

if (document.documentElement) mount()
else document.addEventListener('DOMContentLoaded', mount)
