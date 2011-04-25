/**
 * Copyright 2010 Ajax.org B.V.
 *
 * This product includes software developed by
 * Ajax.org B.V. (http://www.ajax.org/).
 *
 * Author: Fabian Jaokbs <fabian@ajax.org>
 */

var Request = require("../lib/github/Request").Request;
var async_testing = require('../vendor/node-async-testing/async_testing');

var suite = exports.suite = new async_testing.TestSuite();

suite.addTests({
   "test: create request instance" : function(assert) {
        var request = new Request();
        assert.ok(request instanceof Request);
    },

    "test: GET request" : function(assert, finished) {
        var request = new Request();
        request.get('user/search/diem-project', null, null, function(err, response) {
            var sys = require("sys");
            assert.equal(response.users.length, 1, "Found one user");
            assert.equal(response.users[0].name, "diem-project", "Found one user");
            finished();
        });
    }
});

if (module === require.main) {
    async_testing.runSuites({Request: suite});
}