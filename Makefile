test:
	@mocha -c $(find ./test -name "*.test.js")

.PHONY: test
