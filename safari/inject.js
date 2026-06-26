// MAIN-world capture for the Safari build. Wraps fetch / XHR / console and
// forwards events to the content script via window.postMessage. Vanilla JS,
// copied verbatim into the build (no bundling).
;(function () {
  if (window.__404am_injected__) return
  window.__404am_injected__ = true

  var SRC = '404am'
  var reqSeq = 0
  function post(kind, payload) {
    try {
      window.postMessage({ __source: SRC, kind: kind, payload: payload }, '*')
    } catch (e) {}
  }

  function headersToArr(h) {
    var out = []
    try {
      if (h && typeof h.forEach === 'function') h.forEach(function (v, k) { out.push({ name: k, value: v }) })
    } catch (e) {}
    return out
  }

  function reqHeadersFrom(init, input) {
    var out = []
    try {
      var src = (init && init.headers) || (input && input.headers)
      if (!src) return out
      if (typeof src.forEach === 'function') src.forEach(function (v, k) { out.push({ name: k, value: v }) })
      else if (Array.isArray(src)) src.forEach(function (p) { out.push({ name: p[0], value: p[1] }) })
      else Object.keys(src).forEach(function (k) { out.push({ name: k, value: String(src[k]) }) })
    } catch (e) {}
    return out
  }

  // ---- fetch ----
  var origFetch = window.fetch
  if (origFetch) {
    window.fetch = function (input, init) {
      var start = Date.now()
      var requestKey = 'fetch-' + (++reqSeq)
      var method = (init && init.method) || (input && input.method) || 'GET'
      var url = typeof input === 'string' ? input : (input && input.url) || String(input)
      var reqHeaders = reqHeadersFrom(init, input)
      var reqBody
      try { if (init && typeof init.body === 'string') reqBody = init.body } catch (e) {}

      post('request', {
        requestKey: requestKey,
        lifecycleStatus: 'pending',
        method: String(method).toUpperCase(),
        url: url,
        status: 0,
        statusText: 'Pending',
        resourceType: 'fetch',
        durationMs: -1,
        startedDateTime: new Date(start).toISOString(),
        requestHeaders: reqHeaders,
        responseHeaders: [],
        requestBody: reqBody != null ? { mimeType: '', text: reqBody } : undefined,
        responseMimeType: '',
        responseBodySize: 0,
        responseBody: '',
        responseEncoding: '',
      })

      return origFetch.apply(this, arguments).then(
        function (res) {
          var dur = Date.now() - start
          var clone = null
          try { clone = res.clone() } catch (e) {}
          function done(text) {
            post('request', {
              requestKey: requestKey,
              lifecycleStatus: 'completed',
              method: String(method).toUpperCase(),
              url: url,
              status: res.status,
              statusText: res.statusText || '',
              resourceType: 'fetch',
              durationMs: dur,
              startedDateTime: new Date(start).toISOString(),
              requestHeaders: reqHeaders,
              responseHeaders: headersToArr(res.headers),
              requestBody: reqBody != null ? { mimeType: '', text: reqBody } : undefined,
              responseMimeType: (res.headers && res.headers.get('content-type')) || '',
              responseBodySize: text ? text.length : 0,
              responseBody: text || '',
              responseEncoding: '',
            })
          }
          if (clone) clone.text().then(done).catch(function () { done('') })
          else done('')
          return res
        },
        function (err) {
          post('request', {
            requestKey: requestKey, lifecycleStatus: 'completed',
            method: String(method).toUpperCase(), url: url, status: 0,
            statusText: 'Network error', resourceType: 'fetch', durationMs: Date.now() - start,
            startedDateTime: new Date(start).toISOString(), requestHeaders: reqHeaders,
            responseHeaders: [], requestBody: reqBody != null ? { mimeType: '', text: reqBody } : undefined,
            responseMimeType: '', responseBodySize: 0, responseBody: '', responseEncoding: '',
          })
          throw err
        },
      )
    }
  }

  // ---- XMLHttpRequest ----
  var XHR = window.XMLHttpRequest
  if (XHR) {
    var open = XHR.prototype.open
    var send = XHR.prototype.send
    var setHeader = XHR.prototype.setRequestHeader
    XHR.prototype.open = function (method, url) {
      this.__404am = { method: method, url: url, headers: [], start: 0 }
      return open.apply(this, arguments)
    }
    XHR.prototype.setRequestHeader = function (k, v) {
      if (this.__404am) this.__404am.headers.push({ name: k, value: v })
      return setHeader.apply(this, arguments)
    }
    XHR.prototype.send = function (body) {
      var self = this
      var meta = self.__404am
      if (meta) {
        meta.start = Date.now()
        meta.requestKey = 'xhr-' + (++reqSeq)
        if (typeof body === 'string') meta.body = body
        post('request', {
          requestKey: meta.requestKey,
          lifecycleStatus: 'pending',
          method: String(meta.method || 'GET').toUpperCase(),
          url: meta.url,
          status: 0,
          statusText: 'Pending',
          resourceType: 'xhr',
          durationMs: -1,
          startedDateTime: new Date(meta.start).toISOString(),
          requestHeaders: meta.headers,
          responseHeaders: [],
          requestBody: meta.body != null ? { mimeType: '', text: meta.body } : undefined,
          responseMimeType: '',
          responseBodySize: 0,
          responseBody: '',
          responseEncoding: '',
        })
        self.addEventListener('loadend', function () {
          var respHeaders = []
          try {
            ;(self.getAllResponseHeaders() || '').trim().split(/[\r\n]+/).forEach(function (line) {
              var i = line.indexOf(':')
              if (i > 0) respHeaders.push({ name: line.slice(0, i).trim(), value: line.slice(i + 1).trim() })
            })
          } catch (e) {}
          var text = ''
          try { if (self.responseType === '' || self.responseType === 'text') text = self.responseText || '' } catch (e) {}
          var ct = ''
          try { ct = self.getResponseHeader('content-type') || '' } catch (e) {}
          post('request', {
            requestKey: meta.requestKey,
            lifecycleStatus: 'completed',
            method: String(meta.method || 'GET').toUpperCase(),
            url: meta.url,
            status: self.status,
            statusText: self.statusText || '',
            resourceType: 'xhr',
            durationMs: Date.now() - meta.start,
            startedDateTime: new Date(meta.start).toISOString(),
            requestHeaders: meta.headers,
            responseHeaders: respHeaders,
            requestBody: meta.body != null ? { mimeType: '', text: meta.body } : undefined,
            responseMimeType: ct,
            responseBodySize: text.length,
            responseBody: text,
            responseEncoding: '',
          })
        })
      }
      return send.apply(this, arguments)
    }
  }

  // ---- console ----
  ;['log', 'info', 'warn', 'error', 'debug'].forEach(function (m) {
    var orig = console[m]
    console[m] = function () {
      try {
        var args = Array.prototype.slice.call(arguments).map(function (a) {
          try {
            if (typeof a === 'string') return a
            if (a instanceof Error) return a.stack || a.message
            return JSON.stringify(a)
          } catch (e) { return String(a) }
        })
        post('log', { level: m, text: args.join(' '), time: Date.now() })
      } catch (e) {}
      return orig.apply(console, arguments)
    }
  })
  window.addEventListener('error', function (e) {
    post('log', {
      level: 'error',
      text: (e.message || 'Error') + (e.filename ? ' (' + e.filename + ':' + e.lineno + ')' : ''),
      time: Date.now(),
    })
  })

  // ---- SPA navigations ----
  var pushState = history.pushState
  history.pushState = function () {
    var r = pushState.apply(this, arguments)
    post('nav', { url: location.href })
    return r
  }
  window.addEventListener('popstate', function () { post('nav', { url: location.href }) })
})()
