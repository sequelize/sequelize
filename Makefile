test:
	@./node_modules/mocha/bin/mocha -c $(find ./test -name "*.test.js")

.PHONY: test
