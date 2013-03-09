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
import org.eclipse.jetty.util.IO;

import javax.servlet.ServletException;
import javax.servlet.http.*;
import java.io.IOException;
import java.math.BigInteger;
import java.util.Random;
import java.util.UUID;

/**
 * @author Mathieu Carbou (mathieu.carbou@gmail.com)
 */
public final class EchoServlet extends HttpServlet {

    private static final Random RANDOM = new Random();

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        write(req, resp);
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        write(req, resp);
    }

    private void write(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        boolean data = req.getParameter("msg") != null && req.getParameter("msg").trim().length() > 0;
        long time = System.currentTimeMillis();
        String body = IO.toString(req.getInputStream());
        Cookie[] cookies = req.getCookies();
        String domain = System.getProperty("domain", "mycila.intra");

        System.out.println(time + " === REQUEST ===");
        System.out.println(" * type=" + req.getMethod());
        System.out.println(" * uri=" + req.getRequestURI());
        System.out.println(" * query=" + req.getQueryString());
        System.out.println(" * locale=" + req.getLocale());
        System.out.println(" * content-type=" + req.getContentType());
        System.out.println(" * content-length=" + req.getContentLength());
        System.out.println(" * msg=" + req.getParameter("msg"));
        System.out.println(" * body=" + body);
        for (Cookie cookie : cookies) {
            System.out.println(" * cookie [" + cookie.getName() + "]=" + cookie.getValue());
        }

        System.out.println(time + " === SESSION ===");
        HttpSession session = req.getSession(false);
        if (session != null) {
            System.out.println(" * id=" + session.getId());
            System.out.println(" * new=" + session.isNew());
            System.out.println(" * rmbr=" + session.getAttribute("rmbr"));
        }

        if (data) {
            String rmbrVal = UUID.randomUUID().toString();
            body = "{\"val\":\"" + new BigInteger(1024, RANDOM).toString() + "\"}";

            req.getSession().setAttribute("rmbr", rmbrVal);
            req.getSession().setMaxInactiveInterval(60);

            System.out.println(time + " === RESPONSE ===");
            System.out.println(" * rmbr=" + rmbrVal);
            System.out.println(" * length=" + body.length());

            Cookie rmbr = new Cookie("rmbr", rmbrVal);
            rmbr.setDomain("." + domain);
            rmbr.setPath("/");
            rmbr.setMaxAge(60);

            Cookie locale = new Cookie("locale", req.getLocale().toString());
            locale.setDomain("." + domain);
            locale.setPath("/");
            locale.setMaxAge(60);

            resp.addCookie(rmbr);
            resp.addCookie(locale);
            resp.setContentType("application/json");
            resp.setCharacterEncoding("UTF-8");
            resp.setContentLength(body.length());
            resp.getWriter().write(body);
        }

        System.out.println("");
    }
}
