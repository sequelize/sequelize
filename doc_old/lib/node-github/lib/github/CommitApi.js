/**
 * Copyright 2010 Ajax.org B.V.
 *
 * This product includes software developed by
 * Ajax.org B.V. (http://www.ajax.org/).
 *
 * Author: Fabian Jaokbs <fabian@ajax.org>
 */

var sys = require("sys");
var AbstractApi = require("./AbstractApi").AbstractApi;

var CommitApi = exports.CommitApi = function(api) {
    this.$api = api;
};

sys.inherits(CommitApi, AbstractApi);

(function() {
    /**
     * List commits by username, repo and branch
     * http://develop.github.com/p/commits.html#listing_commits_on_a_branch
     *
     * @param {String}  username         the username
     * @param {String}  repo             the repo
     * @param {String}  $branch           the branch
     */
    this.getBranchCommits = function(username, repo, branch, callback)
    {
        this.$api.get(
            'commits/list/' + encodeURI(username) + "/" + encodeURI(repo) + "/" + encodeURI(branch),
            null, null,
            this.$createListener(callback, "commits")
        );
    };

    /**
     * List commits by username, repo, branch and path
     * http://develop.github.com/p/commits.html#listing_commits_for_a_file
     *
     * @param {String}  username         the username
     * @param {String}  repo             the repo
     * @param {String}  branch           the branch
     * @param {String}  path             the path
     */
    this.getFileCommits = function(username, repo, branch, path, callback)
    {
        this.$api.get(
            'commits/list/' + encodeURI(username) + "/" + encodeURI(repo) + "/" + encodeURI(branch) + "/" + encodeURI(path),
            null, null,
            this.$createListener(callback, "commits")
        );
    };

}).call(CommitApi.prototype);