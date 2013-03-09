/**
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
package com.ovea.cors;

import javax.servlet.*;
import javax.servlet.http.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.zip.GZIPInputStream;

/**
 * @author Mathieu Carbou (mathieu.carbou@gmail.com)
 */
public final class IeCorsFilter implements Filter {

    private static final Logger LOGGER = Logger.getLogger(IeCorsFilter.class.getName());
    private static final String[] DAYS = {"Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"};
    private static final String[] MONTHS = {"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan"};
    private static final TimeZone __GMT = TimeZone.getTimeZone("GMT");
    private static final ThreadLocal<DateGenerator> __dateGenerator = new ThreadLocal<DateGenerator>() {
        @Override
        protected DateGenerator initialValue() {
            return new DateGenerator();
        }
    };
    private static final String __01Jan1970_COOKIE = __dateGenerator.get().formatDate(0);

    private static boolean JETTY_SUPPORT;

    static {
        try {
            IeCorsFilter.class.getClassLoader().loadClass("org.eclipse.jetty.server.AbstractHttpConnection");
            JETTY_SUPPORT = true;
        } catch (Throwable e) {
            JETTY_SUPPORT = false;
        }
    }


    @Override
    public void destroy() {
    }

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
    }

    @Override
    public void doFilter(ServletRequest servletRequest, ServletResponse servletResponse, FilterChain filterChain) throws IOException, ServletException {
        final HttpServletRequest req = (HttpServletRequest) servletRequest;
        final HttpServletResponse res = (HttpServletResponse) servletResponse;
        String ua;
        String query = req.getQueryString();
        query = query == null ? "" : query.toLowerCase();
        if (query.contains("_xdr=") && (ua = req.getHeader("User-Agent")) != null && ua.contains("MSIE")) {
            // change content-type for a POST request to allow request parsing if some data is given
            if ("POST".equals(req.getMethod().toUpperCase())) {
                if (JETTY_SUPPORT) {
                    JettySupport.fixContentType(req);
                }
                if (req.getContentType() == null && LOGGER.isLoggable(Level.SEVERE)) {
                    LOGGER.severe("[XDR] No Content-Type received for IE CORS POST request " + req.getRequestURI());
                }
            }
            // intercepts calls which set cookies
            final List<String> headers = new LinkedList<>();
            final ByteArrayOutputStream output = new ByteArrayOutputStream();
            final AtomicInteger status = new AtomicInteger(200);
            final AtomicBoolean closed = new AtomicBoolean(false);
            final long id = getId(req);

            filterChain.doFilter(new HttpServletRequestWrapper(req) {
                                     @Override
                                     public String getHeader(String name) {
                                         return name.equalsIgnoreCase("Accept-Encoding") ? null : super.getHeader(name);
                                     }
                                 }, new HttpServletResponseWrapper(res) {
                                     @Override
                                     public void addCookie(Cookie cookie) {
                                         String header = buildHeader(cookie);
                                         if (LOGGER.isLoggable(Level.FINE)) {
                                             LOGGER.fine("[XDR-" + id + "][" + req.getRequestURI() + "] Adding header " + header + " from cookie " + cookie.getName());
                                         }
                                         super.addCookie(cookie);
                                         headers.add(header);
                                     }

                                     @Override
                                     public void addHeader(String name, String value) {
                                         if ("Set-Cookie".equalsIgnoreCase(name)) {
                                             String header = removeHttpOnly(value);
                                             if (LOGGER.isLoggable(Level.FINE)) {
                                                 LOGGER.fine("[XDR-" + id + "][" + req.getRequestURI() + "] Adding header " + header + " from Set-Cookie header " + value);
                                             }
                                             headers.add(header);
                                         }
                                         super.addHeader(name, value);
                                     }

                                     @Override
                                     public ServletOutputStream getOutputStream() throws IOException {
                                         return new ServletOutputStream() {
                                             @Override
                                             public void write(int b) throws IOException {
                                                 output.write(b);
                                             }

                                             @Override
                                             public String toString() {
                                                 return ServletOutputStream.class.getSimpleName() + "(" + req.getRequestURI() + ")";
                                             }

                                             @Override
                                             public void close() throws IOException {
                                                 writeStream(req, res, headers, status, output.toByteArray(), id, true);
                                                 closed.set(true);
                                             }
                                         };
                                     }

                                     @Override
                                     public PrintWriter getWriter() throws IOException {
                                         return new PrintWriter(new OutputStreamWriter(new OutputStream() {
                                             @Override
                                             public void write(int b) throws IOException {
                                                 output.write(b);
                                             }

                                             @Override
                                             public void close() throws IOException {
                                                 writeStream(req, res, headers, status, output.toByteArray(), id, true);
                                                 closed.set(true);
                                             }
                                         }), true) {
                                             @Override
                                             public String toString() {
                                                 return PrintWriter.class.getSimpleName() + "(" + req.getRequestURI() + ")";
                                             }

                                             @Override
                                             public void write(int c) {
                                                 super.write(c);
                                                 flush();
                                             }

                                             @Override
                                             public void write(char[] buf, int off, int len) {
                                                 super.write(buf, off, len);
                                                 flush();
                                             }

                                             @Override
                                             public void write(String s, int off, int len) {
                                                 super.write(s, off, len);
                                                 flush();
                                             }
                                         };
                                     }

                                     @Override
                                     public void sendError(int sc, String msg) throws IOException {
                                         setStatus(sc);
                                     }

                                     @Override
                                     public void sendError(int sc) throws IOException {
                                         setStatus(sc);
                                     }

                                     @Override
                                     public void setStatus(int sc) {
                                         status.set(sc);
                                     }

                                     @SuppressWarnings("deprecation")
                                     @Override
                                     public void setStatus(int sc, String sm) {
                                         status.set(sc);
                                     }

                                     @Override
                                     public String toString() {
                                         return HttpServletResponse.class.getSimpleName() + "(" + req.getRequestURI() + ")";
                                     }
                                 }
            );

            writeStream(req, res, headers, status, output.toByteArray(), id, false);

        } else {
            filterChain.doFilter(req, res);
        }
    }

    private static long getId(HttpServletRequest req) {
        try {
            return Long.parseLong(req.getParameter("_xdr"));
        } catch (RuntimeException e) {
            return -1;
        }
    }

    private void writeStream(HttpServletRequest req, HttpServletResponse res, List<String> headers, AtomicInteger status, byte[] data, long id, boolean close) throws IOException {
        if (LOGGER.isLoggable(Level.FINE)) {
            LOGGER.fine("[XDR-" + id + "][" + req.getRequestURI() + "] Writing stream (length=" + data.length + ", close=" + close + ", suspended=" + req.isAsyncStarted() + "):\n=> " + new String(data));
        }

        if (req.isAsyncStarted()) {
            return;
        }

        // build header line
        StringBuilder header = new StringBuilder();
        for (String cookie : headers) {
            header.append(header.length() == 0 ? "" : ",").append(cookie);
        }

        // add session id
        String sessionHeader = getSessionHeader(req, res);
        if (sessionHeader != null) {
            header.insert(0, ",").insert(0, sessionHeader);
        }

        // prepare header
        final int len = header.length();
        final boolean needsHeader = len > 0 || status.get() != 200;

        if (needsHeader) {

            header.append("~").append(status.get()).append("~").append(len).append("~");

            if (LOGGER.isLoggable(Level.FINE)) {
                LOGGER.fine("[XDR-" + id + "][" + req.getRequestURI() + "] Appending header: " + header);
            }

            if ("gzip".equals(res.getHeader("Content-Encoding"))) {
                if (LOGGER.isLoggable(Level.FINE)) {
                    LOGGER.fine("[XDR-" + id + "][" + req.getRequestURI() + "] Uncompressing GZIP response...");
                }
                res.setHeader("Content-Encoding", null);
                ByteArrayOutputStream uncompressed = new ByteArrayOutputStream();
                GZIPInputStream gzipStream = new GZIPInputStream(new ByteArrayInputStream(data));
                int c;
                byte[] buffer = new byte[8096];
                while ((c = gzipStream.read(buffer)) != -1) {
                    uncompressed.write(buffer, 0, c);
                }
                res.setContentLength(header.length() + uncompressed.size());
                uncompressed.writeTo(res.getOutputStream());
            } else {
                res.setContentLength(header.length() + data.length);
                res.getOutputStream().write(data);
            }
            res.getOutputStream().write(header.toString().getBytes());
            res.setStatus(HttpServletResponse.SC_OK);
            if (close) {
                res.flushBuffer();
                res.getOutputStream().close();
            }

        } else {
            if (LOGGER.isLoggable(Level.FINE)) {
                LOGGER.fine("[XDR-" + id + "][" + req.getRequestURI() + "] No header to append, status=200, length=" + data.length);
            }
            res.setContentLength(data.length);
            res.getOutputStream().write(data);
            res.setStatus(HttpServletResponse.SC_OK);
            if (close) {
                res.flushBuffer();
                res.getOutputStream().close();
            }
        }
    }

    private static final class DateGenerator {
        private final StringBuilder buf = new StringBuilder(32);
        private final GregorianCalendar gc = new GregorianCalendar(__GMT);

        /**
         * Format HTTP date "EEE, dd MMM yyyy HH:mm:ss 'GMT'"
         */
        public String formatDate(long date) {
            buf.setLength(0);
            gc.setTimeInMillis(date);

            int day_of_week = gc.get(Calendar.DAY_OF_WEEK);
            int day_of_month = gc.get(Calendar.DAY_OF_MONTH);
            int month = gc.get(Calendar.MONTH);
            int year = gc.get(Calendar.YEAR);
            int century = year / 100;
            year = year % 100;

            int hours = gc.get(Calendar.HOUR_OF_DAY);
            int minutes = gc.get(Calendar.MINUTE);
            int seconds = gc.get(Calendar.SECOND);

            buf.append(DAYS[day_of_week]);
            buf.append(',');
            buf.append(' ');
            append2digits(buf, day_of_month);

            buf.append(' ');
            buf.append(MONTHS[month]);
            buf.append(' ');
            append2digits(buf, century);
            append2digits(buf, year);

            buf.append(' ');
            append2digits(buf, hours);
            buf.append(':');
            append2digits(buf, minutes);
            buf.append(':');
            append2digits(buf, seconds);
            buf.append(" GMT");
            return buf.toString();
        }

        /* ------------------------------------------------------------ */

        /**
         * Format "EEE, dd-MMM-yy HH:mm:ss 'GMT'" for cookies
         */
        private void formatCookieDate(StringBuilder buf, long date) {
            gc.setTimeInMillis(date);

            int day_of_week = gc.get(Calendar.DAY_OF_WEEK);
            int day_of_month = gc.get(Calendar.DAY_OF_MONTH);
            int month = gc.get(Calendar.MONTH);
            int year = gc.get(Calendar.YEAR);
            year = year % 10000;

            int epoch = (int) ((date / 1000) % (60 * 60 * 24));
            int seconds = epoch % 60;
            epoch = epoch / 60;
            int minutes = epoch % 60;
            int hours = epoch / 60;

            buf.append(DAYS[day_of_week]);
            buf.append(',');
            buf.append(' ');
            append2digits(buf, day_of_month);

            buf.append('-');
            buf.append(MONTHS[month]);
            buf.append('-');
            append2digits(buf, year / 100);
            append2digits(buf, year % 100);

            buf.append(' ');
            append2digits(buf, hours);
            buf.append(':');
            append2digits(buf, minutes);
            buf.append(':');
            append2digits(buf, seconds);
            buf.append(" GMT");
        }

    }

    private static void append2digits(StringBuilder buf, int i) {
        if (i < 100) {
            buf.append((char) (i / 10 + '0'));
            buf.append((char) (i % 10 + '0'));
        }
    }

    private static String removeHttpOnly(String header) {
        int pos = header.indexOf("HttpOnly");
        if (pos != -1) {
            int start = pos - 1;
            while (header.charAt(start) != ';') {
                start--;
            }
            return header.substring(0, start) + header.substring(pos + 8);
        }
        return header;
    }

    private static String buildHeader(Cookie cookie) {
        StringBuilder header = new StringBuilder(cookie.getName()).append("=").append(cookie.getValue());
        if (cookie.getPath() != null && cookie.getPath().length() > 0) {
            header.append(";Path=").append(cookie.getPath());
        }
        if (cookie.getMaxAge() >= 0) {
            header.append(";Expires=");
            if (cookie.getMaxAge() == 0) {
                header.append(__01Jan1970_COOKIE);
            } else {
                __dateGenerator.get().formatCookieDate(header, System.currentTimeMillis() + 1000L * cookie.getMaxAge());
            }
        }
        return header.toString();
    }

    private static String getSessionHeader(HttpServletRequest req, HttpServletResponse res) {
        HttpSession session = req.getSession(false);
        String hSetCookie = res.getHeader("Set-Cookie");
        int start, end;
        if (session != null && hSetCookie != null && (start = hSetCookie.indexOf("=" + session.getId())) != -1) {
            end = start-- + 1;
            for (; start > 0; start--) {
                if (hSetCookie.charAt(start) == ' ' || hSetCookie.charAt(start) == ',') {
                    start++;
                    break;
                }
            }
            boolean expire = false;
            for (int max = hSetCookie.length(); end < max; end++) {
                if (hSetCookie.charAt(end) == ',') {
                    if (!expire && hSetCookie.substring(start, end).contains("Expires=")) {
                        expire = true;
                    } else if (expire || !hSetCookie.substring(start, end).contains("Expires=")) {
                        break;
                    }
                }
            }
            return removeHttpOnly(hSetCookie.substring(start, end));
        }
        return null;
    }

    public static void main(String[] args) {
        System.out.println(removeHttpOnly("rmb=v4RCFyjQG/EVpqbUh0bh/dKBUXDr8m/xRn0ZOM7wg6U/8itLgwcd66P3Nh18GK1/sVKjdy8C3TYT2+FbH1UYtQ==; Path=/; Max-Age=31536000; Expires=Tue, 26-Feb-2013 16:40:06 GMT; HttpOnly; opt=vv"));
    }
}
