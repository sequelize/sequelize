REPORTER ?= dot
TESTS = $(shell find ./test/* -name "*.test.js")

sqlite:
	@DIALECT=sqlite ./node_modules/mocha/bin/mocha \
		--colors \
		--reporter $(REPORTER) \
		$(TESTS)

mysql:
	@DIALECT=mysql ./node_modules/mocha/bin/mocha \
		--colors \
		--reporter $(REPORTER) \
		$(TESTS)

postgres:
	@DIALECT=postgres ./node_modules/mocha/bin/mocha \
		--colors \
		--reporter $(REPORTER) \
		$(TESTS)

pgsql: postgres

postgres-native:
	@DIALECT=postgres-native ./node_modules/mocha/bin/mocha \
		--colors \
		--reporter $(REPORTER) \
		$(TESTS)

postgresn: postgres-native

.PHONY: sqlite mysql postgres pgsql postgres-native postgresn