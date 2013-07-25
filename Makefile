REPORTER ?= dot

test:
	@./node_modules/mocha/bin/mocha \
		--colors \
		--reporter $(REPORTER) \
		$(shell find ./test/* -name "*.test.js")

.PHONY: test
