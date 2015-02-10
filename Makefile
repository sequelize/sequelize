REPORTER ?= spec
TESTS = $(shell find ./test/integration/* -name "*.test.js")
DIALECT ?= mysql

# test commands

teaser:
	@echo "" && \
	node -pe "Array(20 + '$(DIALECT)'.length + 3).join('#')" && \
	echo '# Running tests for $(DIALECT) #' && \
	node -pe "Array(20 + '$(DIALECT)'.length + 3).join('#')" && \
	echo ''

ifeq (true,$(COVERAGE))
test: codeclimate
else
test:
	make jshint && make teaser && make test-unit && make test-integration
	@if [ "$$GREP" ]; then \
		make jshint && make teaser && ./node_modules/mocha/bin/mocha --globals setImmediate,clearImmediate --ui tdd --check-leaks --colors -t 10000 --reporter $(REPORTER) -g "$$GREP" $(TESTS); \
	else \
		make jshint && make teaser && ./node_modules/mocha/bin/mocha --globals setImmediate,clearImmediate --ui tdd --check-leaks --colors -t 10000 --reporter $(REPORTER) $(TESTS); \
	fi
endif

# Unit tests
test-unit:
	./node_modules/mocha/bin/mocha --globals setImmediate,clearImmediate --ui tdd --check-leaks --colors -t 10000 --reporter $(REPORTER) ./test/unit/**/*.js

test-unit-all: test-unit-sqlite test-unit-mysql test-unit-postgres test-unit-postgres-native test-unit-mariadb test-unit-mssql

test-unit-mariadb:
	@DIALECT=mariadb make test-unit
test-unit-sqlite:
	@DIALECT=sqlite make test-unit
test-unit-mysql:
	@DIALECT=mysql make test-unit
test-unit-mssql:
	@DIALECT=mssql make test-unit
test-unit-postgres:
	@DIALECT=postgres make test-unit
test-unit-postgres-native:
	@DIALECT=postgres-native make test-unit

# Integration tests
test-integration:
	@if [ "$$GREP" ]; then \
		./node_modules/mocha/bin/mocha --globals setImmediate,clearImmediate --ui tdd --check-leaks --colors -t 10000 --reporter $(REPORTER) -g "$$GREP" $(TESTS); \
	else \
		./node_modules/mocha/bin/mocha --globals setImmediate,clearImmediate --ui tdd --check-leaks --colors -t 10000 --reporter $(REPORTER) $(TESTS); \
	fi

test-integration-all: test-integration-sqlite test-integration-mysql test-integration-postgres test-integration-postgres-native test-integration-mariadb test-integration-mssql

test-integration-mariadb:
	@DIALECT=mariadb make test-integration
test-integration-sqlite:
	@DIALECT=sqlite make test-integration
test-integration-mysql:
	@DIALECT=mysql make test-integration
test-integration-mssql:
	@DIALECT=mssql make test-integration
test-integration-postgres:
	@DIALECT=postgres make test-integration
test-integration-postgres-native:
	@DIALECT=postgres-native make test-integration


jshint:
	./node_modules/.bin/jshint lib test

mariadb:
	@DIALECT=mariadb make test
sqlite:
	@DIALECT=sqlite make test
mysql:
	@DIALECT=mysql make test
mssql:
	@DIALECT=mssql make test
postgres:
	@DIALECT=postgres make test
postgres-native:
	@DIALECT=postgres-native make test

# Coverage
cover:
	rm -rf coverage \
	make teaser && ./node_modules/.bin/istanbul cover ./node_modules/.bin/_mocha --report lcovonly -- -t 10000 --ui tdd $(TESTS); \

mariadb-cover:
	rm -rf coverage
	@DIALECT=mariadb make cover
	mv coverage coverage-mariadb
sqlite-cover:
	rm -rf coverage
	@DIALECT=sqlite make cover
	mv coverage coverage-sqlite
mysql-cover:
	rm -rf coverage
	@DIALECT=mysql make cover
	mv coverage coverage-mysql
postgres-cover:
	rm -rf coverage
	@DIALECT=postgres make cover
	mv coverage coverage-postgres
postgres-native-cover:
	rm -rf coverage
	@DIALECT=postgres-native make cover
	mv coverage coverage-postgresnative

merge-coverage:
	rm -rf coverage
	mkdir coverage
	./node_modules/.bin/lcov-result-merger 'coverage-*/lcov.info' 'coverage/lcov.info'

coveralls-send:
	cat ./coverage/lcov.info | ./node_modules/.bin/coveralls && rm -rf ./coverage*

codeclimate-send:
	npm install -g codeclimate-test-reporter
	CODECLIMATE_REPO_TOKEN=ce835a510bbf423a5ab5400a9bdcc2ec2d189d840b31657c6ee7cb9916b161d6 codeclimate < coverage/lcov.info

# test aliases

pgsql: postgres
postgresn: postgres-native

# test all the dialects \o/

all: sqlite mysql postgres postgres-native mariadb

all-cover: sqlite-cover mysql-cover postgres-cover postgres-native-cover mariadb-cover merge-coverage
coveralls: sqlite-cover mysql-cover postgres-cover postgres-native-cover mariadb-cover merge-coverage coveralls-send
codeclimate: sqlite-cover mysql-cover postgres-cover postgres-native-cover mariadb-cover merge-coverage codeclimate-send

.PHONY: sqlite mysql postgres pgsql postgres-native postgresn all test