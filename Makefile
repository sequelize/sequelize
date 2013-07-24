test:
	@./node_modules/mocha/bin/mocha -c $(shell find ./test/* -name "*.test.js")

.PHONY: test
