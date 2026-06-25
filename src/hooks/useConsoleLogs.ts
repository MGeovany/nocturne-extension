import { useCallback, useEffect, useRef, useState } from 'react'
import { isExtensionContextInvalidated } from '../lib/chrome'

export interface ConsoleEntry {
  id: number
  level: 'log' | 'info' | 'warn' | 'error' | 'debug'
  text: string
  time: number
}

// Installed into the inspected page's main world. Monkeypatches console.*
// (and window error events) to push entries into a capped buffer we drain by
// polling. Guarded so repeated installs don't double-wrap.
const INSTALL_EXPR = `(function () {
  if (window.__404AM_INSTALLED__) return 'already';
  window.__404AM_INSTALLED__ = true;
  window.__404AM_LOGS__ = window.__404AM_LOGS__ || [];
  function fmt(a) {
    try {
      if (typeof a === 'string') return a;
      if (a instanceof Error) return a.stack || a.message || String(a);
      if (typeof a === 'object') return JSON.stringify(a);
      return String(a);
    } catch (e) { return String(a); }
  }
  ['log', 'info', 'warn', 'error', 'debug'].forEach(function (m) {
    var orig = console[m];
    console[m] = function () {
      try {
        var args = Array.prototype.slice.call(arguments);
        window.__404AM_LOGS__.push({ level: m, text: args.map(fmt).join(' '), time: Date.now() });
        var q = window.__404AM_LOGS__;
        if (q.length > 2000) q.splice(0, q.length - 2000);
      } catch (e) {}
      return orig.apply(console, arguments);
    };
  });
  window.addEventListener('error', function (e) {
    try {
      var loc = e.filename ? ' (' + e.filename + ':' + e.lineno + ')' : '';
      window.__404AM_LOGS__.push({ level: 'error', text: (e.message || 'Error') + loc, time: Date.now() });
    } catch (_) {}
  });
  return 'installed';
})()`

// Drains and returns whatever has accumulated since the last poll.
const POLL_EXPR = `(function () {
  try {
    var q = window.__404AM_LOGS__;
    if (!q || !q.length) return [];
    return q.splice(0, q.length);
  } catch (e) { return []; }
})()`

interface RawEntry {
  level: ConsoleEntry['level']
  text: string
  time: number
}

/**
 * Captures console output from the inspected page by polling a page-side
 * buffer. Re-installs the hook after navigations (the page reloads and the
 * override is lost). When `preserveLog` is false, logs clear on navigation.
 */
export function useConsoleLogs(preserveLog: boolean) {
  const [logs, setLogs] = useState<ConsoleEntry[]>([])
  const idRef = useRef(0)
  const preserveRef = useRef(preserveLog)

  useEffect(() => {
    preserveRef.current = preserveLog
  }, [preserveLog])

  useEffect(() => {
    let stopped = false
    const stopIfContextInvalidated = (error: unknown) => {
      if (!isExtensionContextInvalidated(error)) throw error
      stopped = true
    }
    const install = () => {
      try {
        chrome.devtools.inspectedWindow.eval(INSTALL_EXPR, () => {})
      } catch (error) {
        stopIfContextInvalidated(error)
      }
    }

    install()

    const poll = () => {
      if (stopped) return
      try {
        chrome.devtools.inspectedWindow.eval(POLL_EXPR, (result, err) => {
          if (stopped || err) return
          const batch = result as RawEntry[] | undefined
          if (!Array.isArray(batch) || batch.length === 0) return
          setLogs((prev) => {
            const next = prev.concat(
              batch.map((r) => ({
                id: idRef.current++,
                level: r.level,
                text: r.text,
                time: r.time,
              })),
            )
            return next.length > 5000 ? next.slice(next.length - 5000) : next
          })
        })
      } catch (error) {
        stopIfContextInvalidated(error)
      }
    }

    const interval = setInterval(poll, 600)

    const onNavigated = () => {
      install() // page reloaded — reinstall the override
      if (!preserveRef.current) setLogs([])
    }
    try {
      chrome.devtools.network.onNavigated.addListener(onNavigated)
    } catch (error) {
      stopIfContextInvalidated(error)
    }

    return () => {
      stopped = true
      clearInterval(interval)
      try {
        chrome.devtools.network.onNavigated.removeListener(onNavigated)
      } catch (error) {
        if (!isExtensionContextInvalidated(error)) throw error
      }
    }
  }, [])

  const clear = useCallback(() => setLogs([]), [])

  return { logs, clear }
}
