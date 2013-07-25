REPORTER ?= dot
TESTS = $(shell find ./test/* -name "*.test.js")

sqlite:
	DIALECT=sqlite
	@./node_modules/mocha/bin/mocha \
		--colors \
		--reporter $(REPORTER) \
		$(TESTS)

mysql:
	DIALECT=mysql
	@./node_modules/mocha/bin/mocha \
		--colors \
		--reporter $(REPORTER) \
		$(TESTS)

.PHONY: sqlite mysql
