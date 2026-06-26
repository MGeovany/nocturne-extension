import type { CapturedRequest } from '../types'

/** Triggers a client-side file download from in-memory text. */
export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** A flat, human-readable JSON dump of the captured metadata. */
export function toJson(reqs: CapturedRequest[]): string {
  const requests = reqs.map((r) => ({
    method: r.method,
    url: r.url,
    lifecycleStatus: r.lifecycleStatus,
    status: r.status,
    statusText: r.statusText,
    resourceType: r.resourceType,
    durationMs: r.durationMs,
    startedDateTime: r.startedDateTime,
    requestHeaders: r.requestHeaders,
    responseHeaders: r.responseHeaders,
    requestBody: r.requestBody,
    responseMimeType: r.responseMimeType,
    responseBodySize: r.responseBodySize,
  }))
  return JSON.stringify(
    { exportedFrom: '404-AM', count: requests.length, requests },
    null,
    2,
  )
}

function queryStringOf(url: string): Array<{ name: string; value: string }> {
  try {
    return [...new URL(url).searchParams].map(([name, value]) => ({ name, value }))
  } catch {
    return []
  }
}

/**
 * Builds a HAR 1.2 log. Response bodies are fetched lazily via getContent(),
 * so this is async. The result imports into Chrome's Network tab, Postman, etc.
 */
export async function toHar(reqs: CapturedRequest[]): Promise<string> {
  const entries = await Promise.all(
    reqs.map(async (r) => {
      let text = ''
      let encoding: string | undefined
      try {
        const c = await r.getContent()
        text = c.content
        encoding = c.encoding || undefined
      } catch {
        // leave body empty if it can't be read
      }
      const time = r.durationMs >= 0 ? r.durationMs : 0
      return {
        startedDateTime: r.startedDateTime,
        time,
        request: {
          method: r.method,
          url: r.url,
          httpVersion: 'HTTP/1.1',
          headers: r.requestHeaders,
          queryString: queryStringOf(r.url),
          cookies: [],
          headersSize: -1,
          bodySize: r.requestBody?.text ? r.requestBody.text.length : 0,
          ...(r.requestBody
            ? { postData: { mimeType: r.requestBody.mimeType, text: r.requestBody.text ?? '' } }
            : {}),
        },
        response: {
          status: r.status,
          statusText: r.statusText,
          httpVersion: 'HTTP/1.1',
          headers: r.responseHeaders,
          cookies: [],
          content: {
            size: r.responseBodySize,
            mimeType: r.responseMimeType,
            text,
            ...(encoding === 'base64' ? { encoding: 'base64' } : {}),
          },
          redirectURL: '',
          headersSize: -1,
          bodySize: r.responseBodySize,
        },
        cache: {},
        timings: { send: 0, wait: time, receive: 0 },
      }
    }),
  )

  return JSON.stringify(
    {
      log: {
        version: '1.2',
        creator: { name: '404-AM', version: '0.1.0' },
        entries,
      },
    },
    null,
    2,
  )
}
