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

var username = 'ornicar';
var repo     = 'php-github-api';
var treeSha  = '691c2ec7fd0b948042047b515886fec40fe76e2b';

suite.setup(function() {
    this.github = new GitHubApi(true);
    this.objectApi = this.github.getObjectApi();
});

suite.addTests({
    "test: show tree" : function(assert, finished, test) {
        this.objectApi.showTree(username, repo, treeSha, function(err, tree) {
            assert.equal(tree.pop().sha, "5ac35496a1cbb2a914ff4325e7d6e8cae61f90b9");
            finished();
        });
    },

    "test: show blob" : function(assert, finished, test) {
        this.objectApi.showBlob(username, repo, treeSha, 'CHANGELOG', function(err, blob) {
            assert.equal(blob.name, "CHANGELOG");
            finished();
        });
    },

    "test: list blobs" : function(assert, finished, test) {
        this.objectApi.listBlobs(username, repo, treeSha, function(err, blobs) {
            assert.equal(blobs["README.markdown"], "d15692fb3adcbb752064c6be20361cf86914d736");
            finished();
        });
    },

    "test: get raw text" : function(assert, finished, test) {
        var expected = [
            "tree d978e4755a9ed4e7ca3ebf9ed674dfb95b4af481",
            "parent e291e9377fd64e08dba556f2dce5b0fc0011430e",
            "author Thibault Duplessis <thibault.duplessis@gmail.com> 1266076405 +0100",
            "committer Thibault Duplessis <thibault.duplessis@gmail.com> 1266076405 +0100",
            "",
            "created README.markdown",
            ""
        ].join("\n");
        this.objectApi.getRawData(username, repo, "bd25d1e4ea7eab84b856131e470edbc21b6cd66b", function(err, data) {
            assert.equal(data, expected);
            finished();
        });
    }
});

if (module === require.main) {
    async_testing.runSuites({ObjectApi: suite});
}