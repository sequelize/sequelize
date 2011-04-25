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

suite.setup(function() {
    this.github = new GitHubApi(true);
    this.repoApi = this.github.getRepoApi();
});

suite.addTests({
    "test: search repos" : function(assert, finished, test) {
        test.repoApi.search("php github api", function(err, repos) {
            assert.ok(repos.length > 0);
            assert.ok(repos[0].name !== undefined);
            finished();
        });
    },

    "test: show repository" : function(assert, finished, test) {
        test.repoApi.show("fjakobs", "qxoo", function(err, repo) {
           assert.equal(repo.name, "qxoo");
           finished();
        });
    },

    "test: get user repos" : function(assert, finished, test) {
        test.repoApi.getUserRepos("fjakobs", function(err, repos) {
            assert.ok(repos.length > 0);
            assert.ok(repos[0].name !== undefined);
            finished();
        });
    },

    "test: get repo tags" : function(assert, finished, test) {
        test.repoApi.getRepoTags("fjakobs", "node", function(err, tags) {
            assert.ok(tags["v0.1.0"] == "813b53938b40484f63e7324c030e33711f26a149");
            finished();
        });
    },

    "test: get repo branches" : function(assert, finished, test) {
        test.repoApi.getRepoBranches("fjakobs", "node", function(err, branches) {
            assert.ok(branches["master"] !== undefined);
            finished();
        });
    }
});

if (module === require.main) {
    async_testing.runSuites({RepoApi: suite});
}