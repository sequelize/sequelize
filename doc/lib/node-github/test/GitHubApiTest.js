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

suite.addTests({
   "test: create API instance" : function(assert) {
        var api = new GitHubApi();
        assert.ok(api instanceof GitHubApi);
    },

    "test loading a repository" : function(assert, finished) {
        var github = new GitHubApi();
        github.get('repos/show/ornicar/php-github-api', null, null, function(err, repo) {
            assert.equal(repo['repository']['name'], 'php-github-api', 'Found information about php-github-api repo');
            finished();
        });
    },

    "test loading a non existing repository should return an error" : function(assert, finished) {
        var github = new GitHubApi();
        github.get('non-existing-url/for-sure', null, null, function(err, repo) {
            assert.ok(err !== undefined);
            finished();
        });
    }
});

if (module === require.main) {
    async_testing.runSuites({GitHubApi: suite});
}