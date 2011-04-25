/**
 * Copyright 2010 Ajax.org B.V.
 *
 * This product includes software developed by
 * Ajax.org B.V. (http://www.ajax.org/).
 *
 * Author: Fabian Jaokbs <fabian@ajax.org>
 */

var GitHubApi = require("../lib/github").GitHubApi;
var async_testing = require('../vendor/node-async-testing/async_testing');

var suite = exports.suite = new async_testing.TestSuite();

var username = 'fjakobstest';
var token = 'b98166e45acf66df70a992e2de56b92a';
var repo = "o3";

suite.setup(function() {
    this.github = new GitHubApi(true);
    this.userApi = this.github.getUserApi();
});

suite.addTests({

    "test: show user without authentification should have no 'plan'" : function(assert, finished, test) {
        test.userApi.show(username, function(err, user) {
            assert.equal(user.plan, undefined);
                finished();
        });
    },

    "test: show user with authentification should have a 'plan'" : function(assert, finished, test) {
        test.github.authenticate(username, token);
        test.userApi.show(username, function(err, user) {
            assert.ok(user.plan !== undefined);
            finished();
        });
    },

    "test: authenticate with bad token" : function(assert, finished, test) {
        test.github.authenticate(username, "bad-token");
        test.userApi.show(username, function(err, user) {
            assert.ok(err !== undefined);
            finished();
        });
    }
});

if (module === require.main) {
    async_testing.runSuites({GitHubApi: suite});
}