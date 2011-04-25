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

var RepoApi = exports.RepoApi = function(api) {
    this.$api = api;
};

sys.inherits(RepoApi, AbstractApi);

(function() {

    /**
     * Search repos by keyword
     * http://develop.github.com/p/repos.html#searching_repositories
     *
     * @param {String}  $query            the search query
     */
    this.search = function(query, callback)
    {
        this.$api.get(
            'repos/search/' + encodeURI(query),
            null, null,
            this.$createListener(callback, "repositories")
        );
    };

    /**
     * Get extended information about a repository by its username and repo name
     * http://develop.github.com/p/repos.html#show_repo_info
     *
     * @param {String}  username         the user who owns the repo
     * @param {String}  repo             the name of the repo
     */
    this.show = function(username, repo, callback)
    {
        this.$api.get(
            'repos/show/' + encodeURI(username) + "/" + encodeURI(repo),
            null, null,
            this.$createListener(callback, "repository")
        );
    };

    /**
     * Get the repositories of a user
     * http://develop.github.com/p/repos.html#list_all_repositories
     *
     * @param {String}  username         the username
     */
    this.getUserRepos = function(username, callback)
    {
        this.$api.get(
            'repos/show/' + encodeURI(username),
            null, null,
            this.$createListener(callback, "repositories")
        );
    };

    /**
     * Get the tags of a repository
     * http://develop.github.com/p/repos.html#repository_refs
     *
     * @param {String}  username         the username
     * @param {String}  repo             the name of the repo
     */
    this.getRepoTags = function(username, repo, callback)
    {
        this.$api.get(
            'repos/show/' + encodeURI(username) + "/" + encodeURI(repo) + "/tags",
            null, null,
            this.$createListener(callback, "tags")
        );
    };

    /**
     * Get the branches of a repository
     * http://develop.github.com/p/repos.html#repository_refs
     *
     * @param {String}  username         the username
     * @param {String}  repo             the name of the repo
     */
    this.getRepoBranches = function(username, repo, callback)
    {
        this.$api.get(
            'repos/show/' + encodeURI(username) + "/" + encodeURI(repo) + "/branches",
            null, null,
            this.$createListener(callback, "branches")
        );
    };

}).call(RepoApi.prototype);


///**
// * Create a new repository
// * @param {String}  repo             name of the repo
// * @param {String}  $description      repo description
// * @param {String}  $homepage         homepage url
// * @param {String}  $public           1 for public, 0 for private
// */
//this.createRepo = function(repo, $description=null, $homepage=null, $public=1, callback)
//{
//   $param = array(
//      'name' => repo,
//      'public'=>$public
//   );
//   if (isset($description)) $param['description'] =  $description;
//   if (isset($homepage)) $param['homepage'] = $homepage;
//
//   $response = $this->api->post('repos/create/', $param);
//
//   return $response;
// }
//
///**
// * Delete a repository
// * @param {String}  repo             name of the repo
// */
//this.deleteRepo = function(repo, callback)
//{
//   if (isset($description)) $param['description'] =  $description;
//   if (isset($homepage)) $param['homepage'] = $homepage;
//
//   $res = $this->api->post('repos/delete/' . repo);
//   $response = $this->api->post('repos/delete/' . repo, array('delete_token' => $res['delete_token']));
//
//   return $response;
// }
//
///**
// * Fork a repository. Requires authentication.
// * @param {String}  username      the username
// * @param {String}  repo          name of the repo
// */
//this.forkRepo = function(username, repo, callback)
//{
//  $response = $this->api->get('repos/fork/'.urlencode(username).'/'.urlencode(repo));
//
//  return $response;
//}
//
///**
// * Show all forks of a repository
// * @param {String}  username      the username
// * @param {String}  repo          name of the repo
// */
//this.getRepoForks = function(username, repo, callback)
//{
//  $response = $this->api->get('repos/show/'.urlencode(username).'/'.urlencode(repo).'/network');
//
//  return $response['network'];
//}
