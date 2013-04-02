# RequireJS Testing

This is a list of things to test before doing a RequireJS release.

**Update all subprojects via ./updatesubs.sh FIRST**

## Items in tests directory

* All browsers: tests/doh/runner.html?testUrl=../all in all the browsers
* go to tests/ run alln.sh and allj.sh
* Optional, only do on major refactors: tests/commonjs, run each file in browser.

## Node testing

Go to r.js project and run the following:

* cd tests
* ./alln.sh
* node allNode.js
* ./allj.sh
* node ../../r.js index.js
* node canvasTest.js (use nave and do the npm installs listed in the JS file)
* cd ../build/tests
* ./alln.sh
* ./allj.sh

Try manual testing:

# Sample jQuery project

Test the sample jQuery project, complete with running the optimizer, testing the output.

# CoffeeScript plugin

Check it.

# jQueryUI AMD project

Check it.