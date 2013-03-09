/*
 * Copyright (C) 2011 Ovea <dev@ovea.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * https://gist.github.com/1114981
 *
 * By default, support transferring session cookie with XDomainRequest for IE. The cookie value is by default 'jsessionid'
 *
 * You can change the session cookie value like this, before including this script:
 *
 * window.XDR_SESSION_COOKIE_NAME = 'ID';
 *
 * Or if you want to disable cookie session support:
 *
 * window.XDR_SESSION_COOKIE_NAME = null;
 *
 * If you need to convert other cookies as headers:
 *
 * window.XDR_COOKIE_HEADERS = ['PHP_SESSION'];
 *
 * To DEBUG:
 *
 * window.XDR_DEBUG = true;
 *
 * To pass some headers:
 *
 * window.XDR_HEADERS = ['Content-Type', 'Accept']
 *
 */
(function ($) {

    if (!('__jquery_xdomain__' in $)
        && $.browser.msie // must be IE
        && 'XDomainRequest' in window // and support XDomainRequest (IE8+)
        && !(window.XMLHttpRequest && 'withCredentials' in new XMLHttpRequest()) // and must not support CORS (IE10+)
        && document.location.href.indexOf("file:///") == -1) { // and must not be local

        $['__jquery_xdomain__'] = $.support.cors = true;

        var urlMatcher = /^(((([^:\/#\?]+:)?(?:\/\/((?:(([^:@\/#\?]+)(?:\:([^:@\/#\?]+))?)@)?(([^:\/#\?]+)(?:\:([0-9]+))?))?)?)?((\/?(?:[^\/\?#]+\/+)*)([^\?#]*)))?(\?[^#]+)?)(#.*)?/,
            oldxhr = $.ajaxSettings.xhr,
            sessionCookie = 'XDR_SESSION_COOKIE_NAME' in window ? window['XDR_SESSION_COOKIE_NAME'] : "jsessionid",
            cookies = 'XDR_COOKIE_HEADERS' in window ? window['XDR_COOKIE_HEADERS'] : [],
            headers = 'XDR_HEADERS' in window ? window['XDR_HEADERS'] : ['Content-Type'],
            ReadyState = {UNSENT:0, OPENED:1, LOADING:3, DONE:4},
            debug = window['XDR_DEBUG'] && 'console' in window,
            XDomainRequestAdapter,
            domain,
            reqId = 0;

        function forEachCookie(names, fn) {
            if (typeof names == 'string') {
                names = [names];
            }
            var i, cookie;
            for (i = 0; i < names.length; i++) {
                cookie = new RegExp('(?:^|; )' + names[i] + '=([^;]*)', 'i').exec(document.cookie);
                cookie = cookie && cookie[1];
                if (cookie) {
                    fn.call(null, names[i], cookie);
                }
            }
        }

        function parseResponse(str) {
            // str === [data][header]~status~hlen~
            // min: ~0~0~
            if (str.length >= 5) {
                // return[0] = status
                // return[1] = data
                // return[2] = header
                var sub = str.substring(str.length <= 20 ? 0 : str.length - 20),
                    i = sub.length - 1,
                    end, hl, st;
                if (sub.charAt(i) === '~') {
                    for (end = i--; i >= 0 && sub.charAt(i) !== '~'; i--);
                    hl = parseInt(sub.substring(i + 1, end));
                    if (!isNaN(hl) && hl >= 0 && i >= 2 && sub.charAt(i) === '~') {
                        for (end = i--; i >= 0 && sub.charAt(i) !== '~'; i--);
                        st = parseInt(sub.substring(i + 1, end));
                        if (!isNaN(st) && i >= 0 && sub.charAt(i) === '~') {
                            end = str.length - hl - sub.length + i;
                            return [st, str.substring(0, end), str.substr(end, hl)];
                        }
                    }
                }
            }
            return [200, str, ''];
        }

        function parseUrl(url) {
            if (typeof(url) === "object") {
                return url;
            }
            var matches = urlMatcher.exec(url);
            return matches ? {
                href:matches[0] || "",
                hrefNoHash:matches[1] || "",
                hrefNoSearch:matches[2] || "",
                domain:matches[3] || "",
                protocol:matches[4] || "",
                authority:matches[5] || "",
                username:matches[7] || "",
                password:matches[8] || "",
                host:matches[9] || "",
                hostname:matches[10] || "",
                port:matches[11] || "",
                pathname:matches[12] || "",
                directory:matches[13] || "",
                filename:matches[14] || "",
                search:matches[15] || "",
                hash:matches[16] || ""
            } : {};
        }

        function parseCookies(header) {
            if (header.length == 0) {
                return [];
            }
            var cooks = [], i = 0, start = 0, end, dom;
            do {
                end = header.indexOf(',', start);
                cooks[i] = (cooks[i] || '') + header.substring(start, end == -1 ? header.length : end);
                start = end + 1;
                if (cooks[i].indexOf('Expires=') == -1 || cooks[i].indexOf(',') != -1) {
                    i++;
                } else {
                    cooks[i] += ',';
                }
            } while (end > 0);
            for (i = 0; i < cooks.length; i++) {
                dom = cooks[i].indexOf('Domain=');
                if (dom != -1) {
                    cooks[i] = cooks[i].substring(0, dom) + cooks[i].substring(cooks[i].indexOf(';', dom) + 1);
                }
            }
            return cooks;
        }

        domain = parseUrl(document.location.href).domain;
        XDomainRequestAdapter = function () {
            var self = this,
                _xdr = new XDomainRequest(),
                _mime,
                _reqHeaders = [],
                _method,
                _url,
                _id = reqId++,
                _setState = function (state) {
                    self.readyState = state;
                    if (typeof self.onreadystatechange === 'function') {
                        self.onreadystatechange.call(self);
                    }
                },
                _done = function (state, code) {
                    if (!self.responseText) {
                        self.responseText = '';
                    }
                    if (debug) {
                        console.log('[XDR-' + _id + '] request end with state ' + state + ' and code ' + code + ' and data length ' + self.responseText.length);
                    }
                    self.status = code;
                    if (!self.responseType) {
                        _mime = _mime || _xdr.contentType;
                        if (_mime.match(/\/json/)) {
                            self.responseType = 'json';
                            self.response = self.responseText;
                        } else if (_mime.match(/\/xml/)) {
                            self.responseType = 'document';
                            var $error, dom = new ActiveXObject('Microsoft.XMLDOM');
                            dom.async = false;
                            dom.loadXML(self.responseText);
                            self.responseXML = self.response = dom;
                            if ($(dom).children('error').length != 0) {
                                $error = $(dom).find('error');
                                self.status = parseInt($error.attr('response_code'));
                            }
                        } else {
                            self.responseType = 'text';
                            self.response = self.responseText;
                        }
                    }
                    _setState(state);
                    // clean memory
                    _xdr = null;
                    _reqHeaders = null;
                    _url = null;
                };
            _xdr.onprogress = function () {
                _setState(ReadyState.LOADING);
            };
            _xdr.ontimeout = function () {
                _done(ReadyState.DONE, 408);
            };
            _xdr.onerror = function () {
                _done(ReadyState.DONE, 500);
            };
            _xdr.onload = function () {
                // check if we are using a filter which modify the response
                var cooks, i, resp = parseResponse(_xdr.responseText || '');
                if (debug) {
                    console.log('[XDR-' + reqId + '] parsing cookies for header ' + resp[2]);
                }
                cooks = parseCookies(resp[2]);
                self.responseText = resp[1] || '';
                if (debug) {
                    console.log('[XDR-' + _id + '] raw data:\n' + _xdr.responseText + '\n parsed response: status=' + resp[0] + ', header=' + resp[2] + ', data=\n' + resp[1]);
                }
                for (i = 0; i < cooks.length; i++) {
                    if (debug) {
                        console.log('[XDR-' + _id + '] installing cookie ' + cooks[i]);
                    }
                    document.cookie = cooks[i] + ";Domain=" + document.domain;
                }
                _done(ReadyState.DONE, resp[0]);
                resp = null;
            };
            this.readyState = ReadyState.UNSENT;
            this.status = 0;
            this.statusText = '';
            this.responseType = '';
            this.timeout = 0;
            this.withCredentials = false;
            this.overrideMimeType = function (mime) {
                _mime = mime;
            };
            this.abort = function () {
                _xdr.abort();
            };
            this.setRequestHeader = function (k, v) {
                if ($.inArray(k, headers) >= 0) {
                    _reqHeaders.push({k:k, v:v});
                }
            };
            this.open = function (m, u) {
                _url = u;
                _method = m;
                _setState(ReadyState.OPENED);
            };
            this.send = function (data) {
                _xdr.timeout = this.timeout;
                if (sessionCookie || cookies || _reqHeaders.length) {
                    var h, addParam = function (name, value) {
                        var q = _url.indexOf('?');
                        _url += (q == -1 ? '?' : '&') + name + '=' + encodeURIComponent(value);
                        if (debug) {
                            console.log('[XDR-' + _id + '] added parameter ' + name + "=" + value + " => " + _url);
                        }
                    };
                    for (h = 0; h < _reqHeaders.length; h++) {
                        addParam(_reqHeaders[h].k, _reqHeaders[h].v);
                    }
                    forEachCookie(sessionCookie, function (name, value) {
                        var q = _url.indexOf('?');
                        if (q == -1) {
                            _url += ';' + name + '=' + value;
                        } else {
                            _url = _url.substring(0, q) + ';' + name + '=' + value + _url.substring(q);
                        }
                        if (debug) {
                            console.log('[XDR-' + _id + '] added cookie ' + _url);
                        }
                    });
                    forEachCookie(cookies, addParam);
                    addParam('_xdr', '' + _id);
                }
                if (debug) {
                    console.log('[XDR-' + _id + '] opening ' + _url);
                }
                _xdr.open(_method, _url);
                if (debug) {
                    console.log('[XDR-' + _id + '] send, timeout=' + _xdr.timeout);
                }
                _xdr.send(data);
            };
            this.getAllResponseHeaders = function () {
                return '';
            };
            this.getResponseHeader = function () {
                return null;
            }
        };

        $.ajaxSettings.xhr = function () {
            var target = parseUrl(this.url).domain;
            if (target === "" || target === domain) {
                return oldxhr.call($.ajaxSettings);
            } else {
                try {
                    return new XDomainRequestAdapter();
                } catch (e) {
                }
            }
        };

    }
})
    (jQuery);
