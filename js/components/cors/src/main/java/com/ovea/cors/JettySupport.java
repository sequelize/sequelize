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

import org.eclipse.jetty.http.HttpHeaders;

import javax.servlet.http.HttpServletRequest;
import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;

/**
 * @author Mathieu Carbou (mathieu.carbou@gmail.com)
 */
final class JettySupport {
    public static void fixContentType(HttpServletRequest req) {
        String query = req.getQueryString();
        if (query != null) {
            query = query.toLowerCase();
            int pos = query.indexOf("content-type");
            if (pos != -1) {
                pos = query.indexOf('=', pos);
                int end = query.indexOf('&', pos);
                if (end == -1) {
                    end = query.length();
                }
                String dec;
                try {
                    dec = URLDecoder.decode(query.substring(pos + 1, end), "UTF-8");
                } catch (UnsupportedEncodingException e) {
                    // should never occur
                    throw new RuntimeException(e.getMessage(), e);
                }
                pos = dec.indexOf(";"); // charset ?
                if (pos != -1) {
                    dec = dec.substring(0, pos).trim();
                }
                org.eclipse.jetty.server.AbstractHttpConnection.getCurrentConnection().getRequestFields().add(HttpHeaders.CONTENT_TYPE, dec);
            }
        }
    }
}
