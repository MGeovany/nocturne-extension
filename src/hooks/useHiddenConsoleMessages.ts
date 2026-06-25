import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ConsoleEntry } from './useConsoleLogs'
import { ignoreExtensionContextInvalidated } from '../lib/chrome'

const STORAGE_KEY = 'fourohfour_hidden_console_v1'

interface HiddenConsoleRule {
  level: ConsoleEntry['level']
  text: string
}

function keyOf(level: ConsoleEntry['level'], text: string) {
  return `${level}\n${text}`
}

export function useHiddenConsoleMessages() {
  const [rules, setRules] = useState<HiddenConsoleRule[]>([])
  const loaded = useRef(false)

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      loaded.current = true
      return
    }
    try {
      chrome.storage.local.get(STORAGE_KEY, (res) => {
        const saved = res?.[STORAGE_KEY]
        if (Array.isArray(saved)) {
          setRules(
            saved.filter(
              (r): r is HiddenConsoleRule =>
                typeof r?.level === 'string' && typeof r?.text === 'string',
            ),
          )
        }
        loaded.current = true
      })
    } catch (error) {
      loaded.current = true
      ignoreExtensionContextInvalidated(error)
    }
  }, [])

  useEffect(() => {
    if (!loaded.current) return
    try {
      if (typeof chrome !== 'undefined') chrome.storage?.local?.set({ [STORAGE_KEY]: rules })
    } catch (error) {
      ignoreExtensionContextInvalidated(error)
    }
  }, [rules])

  const hiddenKeys = useMemo(() => new Set(rules.map((r) => keyOf(r.level, r.text))), [rules])

  const isHidden = useCallback(
    (entry: Pick<ConsoleEntry, 'level' | 'text'>) => hiddenKeys.has(keyOf(entry.level, entry.text)),
    [hiddenKeys],
  )

  const hide = useCallback((entry: Pick<ConsoleEntry, 'level' | 'text'>) => {
    setRules((prev) => {
      const key = keyOf(entry.level, entry.text)
      if (prev.some((r) => keyOf(r.level, r.text) === key)) return prev
      return prev.concat({ level: entry.level, text: entry.text })
    })
  }, [])

  const clear = useCallback(() => setRules([]), [])

  return { isHidden, hide, clear, hiddenRuleCount: rules.length }
}
