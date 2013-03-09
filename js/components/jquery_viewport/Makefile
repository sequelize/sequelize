# $Id$

VERSION = 0.8.2
SHELL = /bin/sh
DOWNLOAD = /var/www/www.appelsiini.net/htdocs/download
JSPACKER = /home/tuupola/bin/jspacker
JSMIN = /home/tuupola/bin/jsmin

all: viewport packed minified latest

viewport: jquery.viewport.js
	cp jquery.viewport.js $(DOWNLOAD)/jquery.viewport-$(VERSION).js

packed: jquery.viewport.js
	$(JSPACKER) < jquery.viewport.js > jquery.viewport.pack.js
	cp jquery.viewport.pack.js $(DOWNLOAD)/jquery.viewport-$(VERSION).pack.js

minified: jquery.viewport.js
	$(JSMIN) < jquery.viewport.js > jquery.viewport.mini.js 
	cp jquery.viewport.mini.js $(DOWNLOAD)/jquery.viewport-$(VERSION).mini.js

latest: jquery.viewport.js jquery.viewport.pack.js jquery.viewport.mini.js
	cp jquery.viewport.js $(DOWNLOAD)/jquery.viewport.js
	cp jquery.viewport.pack.js $(DOWNLOAD)/jquery.viewport.pack.js
	cp jquery.viewport.mini.js $(DOWNLOAD)/jquery.viewport.mini.js

