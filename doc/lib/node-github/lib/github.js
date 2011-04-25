/**
 * Copyright 2010 Ajax.org B.V.
 *
 * This product includes software developed by
 * Ajax.org B.V. (http://www.ajax.org/).
 *
 * Author: Fabian Jaokbs <fabian@ajax.org>
 */

var Request = require("./github/Request").Request;

/**
 * Simple JavaScript GitHub API
 *
 * Based on the PHP GitHub API project http://github.com/ornicar/php-github-api
 */

var GitHubApi = exports.GitHubApi = function(debug) {
    /**
     * Use debug mode (prints debug messages)
     */
    this.$debug = debug;

    /**
     * The list of loaded API instances
     */
    this.$apis = [];
};

(function() {

    /**
     * The request instance used to communicate with GitHub
     */
    this.$request = null;

    /**
     * Authenticate a user for all next requests
     *
     * @param {String} login      GitHub username
     * @param {String} token      GitHub private token
     * @return {GitHubApi}        fluent interface
     */
    this.authenticate = function(login, token)
    {
        this.getRequest()
            .setOption('login', login)
            .setOption('token', token);

        return this;
    };

    /**
     * Deauthenticate a user for all next requests
     *
     * @return {GitHubApi}               fluent interface
     */
    this.deAuthenticate = function() {
        return this.authenticate(null, null);
    };

    /**
     * Call any route, GET method
     * Ex: api.get('repos/show/my-username/my-repo')
     *
     * @param {String}  route            the GitHub route
     * @param {Object}  parameters       GET parameters
     * @param {Object}  requestOptions   reconfigure the request
     * @return {Array}                    data returned
     */
    this.get = function(route, parameters, requestOptions, callback) {
        return this.getRequest().get(route, parameters || {}, requestOptions, callback);
    };

    /**
     * Call any route, POST method
     * Ex: api.post('repos/show/my-username', {'email': 'my-new-email@provider.org'})
     *
     * @param {String}  route            the GitHub route
     * @param {Object}  parameters       POST parameters
     * @param {Object}  requestOptions   reconfigure the request
     * @return {Array}                     data returned
     */
    this.post = function(route, parameters, requestOptions, callback) {
        return this.getRequest().post(route, parameters || {}, requestOptions, callback);
    };

    /**
     * Get the request
     *
     * @return {Request}  a request instance
     */
    this.getRequest = function()
    {
        if(!this.request) {
            this.request = new Request({debug: this.debug});
        }

        return this.request;
    };

    /**
     * Get the user API
     *
     * @return {UserApi}  the user API
     */
    this.getUserApi = function()
    {
        if(!this.$apis['user']) {
            this.$apis['user'] = new (require("./github/UserApi").UserApi)(this);
        }

        return this.$apis['user'];
    };

    /**
     * Get the repo API
     *
     * @return {RepoApi}  the repo API
     */
    this.getRepoApi = function()
    {
        if(!this.$apis['repo']) {
            this.$apis['repo'] = new (require("./github/RepoApi").RepoApi)(this);
        }

        return this.$apis['repo'];
     };

    /**
     * Get the issue API
     *
     * @return {IssueApi} the issue API
     */
    this.getIssueApi = function()
    {
        if(!this.$apis['issue']) {
            this.$apis['issue'] = new (require("./github/IssueApi").IssueApi)(this);
        }

        return this.$apis['issue'];
    };

    /**
     * Get the object API
     *
     * @return {ObjectApi} the object API
     */
    this.getObjectApi = function()
    {
        if(!this.$apis['object']) {
            this.$apis['object'] = new (require("./github/ObjectApi").ObjectApi)(this);
        }

        return this.$apis['object'];
    };

    /**
     * Get the commit API
     *
     * @return {CommitTest} the commit API
     */
    this.getCommitApi = function()
    {
        if(!this.$apis['commit']) {
            this.$apis['commit'] = new (require("./github/CommitApi").CommitApi)(this);
        }

        return this.$apis['commit'];
    };

}).call(GitHubApi.prototype);