
SRC = lib/lunr.js \
	lib/tokenizer.js \
	lib/pipeline.js \
	lib/vector.js \
	lib/sorted_set.js \
	lib/index.js \
	lib/document_store.js \
	lib/stemmer.js \
	lib/stop_word_filter.js \
	lib/token_store.js

YEAR = $(shell date +%Y)
VERSION = $(shell cat VERSION)

all: lunr.js lunr.min.js docs

lunr.js: $(SRC)
	cat $^ | \
	sed "s/@YEAR/${YEAR}/" | \
	sed "s/@VERSION/${VERSION}/" > $@

lunr.min.js: lunr.js
	uglifyjs < $< > $@

size: lunr.min.js
	gzip -c lunr.min.js | wc -c

test:
	node server.js 3000

docs:
	dox < lunr.js | dox-template -n lunr.js -r ${VERSION} > docs/index.html

clean:
	rm -f lunr{.min,}.js

.PHONY: test clean docs
