/**
 * Copyright 2010 Ajax.org B.V.
 *
 * This product includes software developed by
 * Ajax.org B.V. (http://www.ajax.org/).
 *
 * Author: Fabian Jaokbs <fabian@ajax.org>
 */

var sys = require("sys");
var GitHubApi = require("../lib/github").GitHubApi;
var async_testing = require('../vendor/node-async-testing/async_testing');

var suite = exports.suite = new async_testing.TestSuite();

var username = "ornicar";
var branch = "master";
var repo = "php-github-api";

suite.setup(function() {
    this.github = new GitHubApi(true);
    this.commitApi = this.github.getCommitApi();
});

suite.addTests({
    "test: list branch commits" : function(assert, finished, test) {
        test.commitApi.getBranchCommits(username, repo, branch, function(err, commits) {
            assert.ok(commits.length > 0);
            assert.ok(commits[0].message !== undefined);
            finished();
        });
    },

    "test: get file commits" : function(assert, finished, test) {
        test.commitApi.getFileCommits(username, repo, branch, "README", function(err, commits) {
            assert.ok(commits.length > 0);
            assert.equal(commits.pop().message, "first commit");
            finished();
        });
    }
});

if (module === require.main) {
    async_testing.runSuites({CommitApi: suite});
}