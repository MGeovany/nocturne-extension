import type { CapturedRequest, HarHeader } from '../types'
import type { ConsoleEntry } from '../hooks/useConsoleLogs'
import { getTraceIds, isImportant, maskValue } from './headers'
import { tryFormatJson } from './json'

const MAX_BODY = 4000

function classify(status: number): string {
  if (status === 0) return 'the request never completed (network error / blocked / CORS)'
  if (status >= 500) return 'a 5xx server-side error'
  if (status >= 400) return 'a 4xx client-side error (request was rejected)'
  if (status >= 300) return 'a 3xx redirect'
  return 'a successful response'
}

function isRequestError(status: number): boolean {
  return status === 0 || status >= 400
}

function isRedirect(status: number): boolean {
  return status >= 300 && status < 400
}

function responseHeader(req: CapturedRequest, name: string): string | undefined {
  const lower = name.toLowerCase()
  return req.responseHeaders.find((h) => h.name.toLowerCase() === lower)?.value
}

function requestSummaryLines(req: CapturedRequest): string[] {
  const summary: string[] = []
  summary.push(`- \`${req.method} ${req.url}\``)
  summary.push(
    `- Result: **${req.status || 'no status'} ${req.statusText}** — ${classify(req.status)}`,
  )
  summary.push(`- Duration: ${req.durationMs >= 0 ? `${req.durationMs} ms` : 'unknown'}`)
  if (req.responseBodySize >= 0) {
    summary.push(`- Response size: ${req.responseBodySize} bytes`)
  }
  return summary
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

// Sensitive values are always masked here — this text is meant to be pasted
// into an AI chat, so secrets must not leak.
function headerLines(headers: HarHeader[], onlyImportant: boolean): string {
  const list = onlyImportant ? headers.filter((h) => isImportant(h.name)) : headers
  if (list.length === 0) return '  (none)'
  return list.map((h) => `  ${h.name}: ${maskValue(h.name, h.value)}`).join('\n')
}

function truncate(text: string): string {
  if (text.length <= MAX_BODY) return text
  return text.slice(0, MAX_BODY) + `\n… [truncated ${text.length - MAX_BODY} chars]`
}

function fence(text: string, lang = ''): string {
  return '```' + lang + '\n' + text + '\n```'
}

interface BriefOptions {
  responseBody: string
  isBinary: boolean
  consoleLogs?: ConsoleEntry[]
}

/**
 * Builds a self-contained, AI-friendly debug brief for a request — where to
 * look in the codebase, secret-masked request/response context, and recent
 * console errors. Failure details are included only for 4xx/5xx (or incomplete)
 * responses.
 */
export function toAiBrief(req: CapturedRequest, opts: BriefOptions): string {
  const path = pathOf(req.url)
  const failed = isRequestError(req.status)
  const traces = getTraceIds(req.requestHeaders, req.responseHeaders)
  const reqJson = req.requestBody?.text
    ? tryFormatJson(req.requestBody.text, req.requestBody.mimeType)
    : null
  const resJson =
    !opts.isBinary && opts.responseBody
      ? tryFormatJson(opts.responseBody, req.responseMimeType)
      : null
  const relevantLogs = (opts.consoleLogs ?? [])
    .filter((l) => l.level === 'error' || l.level === 'warn')
    .slice(-15)

  const lines: string[] = []
  if (failed) {
    lines.push('# Failed network request — debug brief')
    lines.push('')
    lines.push(
      'A network request in my web app failed. Help me find the root cause in my codebase and propose a fix.',
    )
    lines.push('')
    lines.push('## What failed')
    lines.push(`- \`${req.method} ${req.url}\``)
    lines.push(
      `- Result: **${req.status || 'no status'} ${req.statusText}** — ${classify(req.status)}`,
    )
    lines.push(`- Duration: ${req.durationMs >= 0 ? `${req.durationMs} ms` : 'unknown'}`)
    lines.push('')
  } else if (isRedirect(req.status)) {
    lines.push('# Redirect — context brief')
    lines.push('')
    lines.push(
      'This request returned a redirect. Help me trace where it points and how it is handled in my codebase.',
    )
    lines.push('')
    lines.push('## Redirect')
    const redirectSummary = requestSummaryLines(req)
    const location = responseHeader(req, 'location')
    if (location) {
      redirectSummary.push(`- Location: \`${location}\``)
    }
    lines.push(...redirectSummary)
    lines.push('')
  } else {
    lines.push('# Network request — context brief')
    lines.push('')
    lines.push(
      'This request succeeded. Help me understand what it does and how it fits into my codebase.',
    )
    lines.push('')
    lines.push('## Request summary')
    lines.push(...requestSummaryLines(req))
    lines.push('')
  }
  lines.push('## Where to look')
  lines.push(`- Endpoint path: \`${path}\``)
  lines.push(
    `- Find the call site in the codebase: search for \`${path}\` (or the surrounding URL) in fetch/axios/XHR calls.`,
  )
  if (traces.length > 0) {
    lines.push(
      `- Correlate with backend logs using: ${traces
        .map((t) => `\`${t.name}=${t.value}\``)
        .join(', ')}`,
    )
  }
  lines.push('')
  lines.push('## Request')
  lines.push('Headers (important):')
  lines.push(fence(headerLines(req.requestHeaders, true)))
  if (req.requestBody?.text) {
    lines.push('Body:')
    lines.push(fence(truncate(reqJson?.formatted ?? req.requestBody.text), reqJson?.isJson ? 'json' : ''))
  }
  lines.push('')
  lines.push('## Response')
  lines.push('Headers (important):')
  lines.push(fence(headerLines(req.responseHeaders, true)))
  lines.push('Body:')
  if (opts.isBinary) {
    lines.push(`(binary content, ${req.responseBodySize} bytes, ${req.responseMimeType})`)
  } else if (!opts.responseBody) {
    lines.push('(empty)')
  } else {
    lines.push(fence(truncate(resJson?.formatted ?? opts.responseBody), resJson?.isJson ? 'json' : ''))
  }

  if (relevantLogs.length > 0) {
    lines.push('')
    lines.push('## Recent console errors/warnings')
    lines.push(fence(relevantLogs.map((l) => `[${l.level}] ${l.text}`).join('\n')))
  }

  return lines.join('\n')
}
