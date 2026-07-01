// MAIN-world capture for the Safari build. Wraps fetch / XHR / console and
// forwards events to the content script via window.postMessage. Vanilla JS,
// copied verbatim into the build (no bundling).
;(function () {
  if (window.__nocturne_injected__) return
  window.__nocturne_injected__ = true

  var SRC = 'nocturne'
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

  function isTextMime(mime) {
    mime = String(mime || '').toLowerCase()
    return !mime || mime.indexOf('text/') === 0 ||
      mime.indexOf('json') !== -1 ||
      mime.indexOf('xml') !== -1 ||
      mime.indexOf('javascript') !== -1 ||
      mime.indexOf('x-www-form-urlencoded') !== -1
  }

  function bytesToBase64(buffer) {
    var bytes = new Uint8Array(buffer || 0)
    var chunk = 0x8000
    var out = ''
    for (var i = 0; i < bytes.length; i += chunk) {
      out += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
    }
    return btoa(out)
  }

  function readFetchBody(res, done) {
    var mime = ''
    try { mime = (res.headers && res.headers.get('content-type')) || '' } catch (e) {}
    if (isTextMime(mime)) {
      try {
        res.clone().text().then(function (text) {
          done(text || '', '', (text || '').length)
        }).catch(function () {
          readFetchBinary(res, done)
        })
        return
      } catch (e) {}
    }
    readFetchBinary(res, done)
  }

  function readFetchBinary(res, done) {
    try {
      res.clone().arrayBuffer().then(function (buffer) {
        done(bytesToBase64(buffer), 'base64', buffer.byteLength || 0)
      }).catch(function () { done('', '', 0) })
    } catch (e) {
      done('', '', 0)
    }
  }

  function stringifyResponse(value) {
    if (value == null) return ''
    if (typeof value === 'string') return value
    try { return JSON.stringify(value, null, 2) } catch (e) { return String(value) }
  }

  function readXhrBody(xhr, contentType, done) {
    var responseType = ''
    try { responseType = xhr.responseType || '' } catch (e) {}
    try {
      if (responseType === '' || responseType === 'text') {
        var text = xhr.responseText || ''
        done(text, '', text.length)
        return
      }
      if (responseType === 'json') {
        var json = stringifyResponse(xhr.response)
        done(json, '', json.length)
        return
      }
      if (responseType === 'document') {
        var doc = xhr.response
        var html = doc && doc.documentElement ? doc.documentElement.outerHTML : ''
        done(html, '', html.length)
        return
      }
      if (responseType === 'arraybuffer') {
        var buffer = xhr.response
        done(bytesToBase64(buffer), 'base64', buffer ? buffer.byteLength : 0)
        return
      }
      if (responseType === 'blob' && xhr.response) {
        if (isTextMime(contentType) && typeof xhr.response.text === 'function') {
          xhr.response.text().then(function (text) { done(text || '', '', (text || '').length) })
            .catch(function () { done('', '', 0) })
          return
        }
        if (typeof FileReader !== 'undefined') {
          var reader = new FileReader()
          reader.onload = function () {
            var result = String(reader.result || '')
            var comma = result.indexOf(',')
            var data = comma >= 0 ? result.slice(comma + 1) : result
            done(data, 'base64', xhr.response.size || 0)
          }
          reader.onerror = function () { done('', '', 0) }
          reader.readAsDataURL(xhr.response)
          return
        }
      }
    } catch (e) {}
    done('', '', 0)
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
          function done(content, encoding, size) {
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
              responseBodySize: size || 0,
              responseBody: content || '',
              responseEncoding: encoding || '',
            })
          }
          if (clone) readFetchBody(res, done)
          else done('', '', 0)
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
      this.__nocturne = { method: method, url: url, headers: [], start: 0 }
      return open.apply(this, arguments)
    }
    XHR.prototype.setRequestHeader = function (k, v) {
      if (this.__nocturne) this.__nocturne.headers.push({ name: k, value: v })
      return setHeader.apply(this, arguments)
    }
    XHR.prototype.send = function (body) {
      var self = this
      var meta = self.__nocturne
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
          var ct = ''
          try { ct = self.getResponseHeader('content-type') || '' } catch (e) {}
          readXhrBody(self, ct, function (content, encoding, size) {
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
              responseBodySize: size || 0,
              responseBody: content || '',
              responseEncoding: encoding || '',
            })
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
