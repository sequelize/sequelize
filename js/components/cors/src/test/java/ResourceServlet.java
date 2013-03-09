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
import org.eclipse.jetty.http.MimeTypes;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.*;

/**
 * @author Mathieu Carbou (mathieu.carbou@gmail.com)
 */
public final class ResourceServlet extends HttpServlet {
    private static final MimeTypes MIME_TYPES = new MimeTypes();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        String res = req.getPathInfo().startsWith("/") ? req.getPathInfo().substring(1) : req.getPathInfo();
        File file = new File(res);
        if (!file.exists()) {
            resp.sendError(HttpServletResponse.SC_NOT_FOUND, req.getPathInfo());
        } else {
            OutputStream out = resp.getOutputStream();
            try (InputStream in = new BufferedInputStream(new FileInputStream(file))) {
                byte[] data = new byte[8096];
                int c;
                int len = 0;
                while ((c = in.read(data)) != -1) {
                    len += c;
                    out.write(data, 0, c);
                }
                resp.setContentLength(len);
                resp.setContentType(MIME_TYPES.getMimeByExtension(req.getPathInfo()).toString());
            } finally {
                out.flush();
            }
        }
    }
}
