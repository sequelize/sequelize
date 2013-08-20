REPORTER ?= dot
TESTS = $(shell find ./test/* -name "*.test.js")
DIALECT ?= mysql

# test commands

teaser:
	@echo "" && \
	node -pe "Array(20 + '$(DIALECT)'.length + 3).join('#')" && \
	echo '# Running tests for $(DIALECT) #' && \
	node -pe "Array(20 + '$(DIALECT)'.length + 3).join('#')" && \
	echo ''

test:
	@make teaser && \
	./node_modules/mocha/bin/mocha \
	--colors \
	--reporter $(REPORTER) \
	$(TESTS)

sqlite:
	@DIALECT=sqlite make test
mysql:
	@DIALECT=mysql make test
postgres:
	@DIALECT=postgres make test
postgres-native:
	@DIALECT=postgres-native make test
binary:
	@./test/binary/sequelize.test.bats

# test aliases

pgsql: postgres
postgresn: postgres-native

# test all the dialects \o/

all: sqlite mysql postgres postgres-native

.PHONY: sqlite mysql postgres pgsql postgres-native postgresn all test
