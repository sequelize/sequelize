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

var UserApi = exports.UserApi = function(api) {
    this.$api = api;
};

sys.inherits(UserApi, AbstractApi);

(function() {

    /**
     * Search users by username
     * http://develop.github.com/p/users.html#searching_for_users
     *
     * @param {String}  username         the username to search
     */
    this.search = function(username, callback)
    {
      this.$api.get(
          'user/search/' + encodeURI(username),
          null, null,
          this.$createListener(callback, "users")
      );
    };

    /**
     * Get extended information about a user by its username
     * http://develop.github.com/p/users.html#getting_user_information
     *
     * @param {String}  username         the username to show
     */
    this.show = function(username, callback)
    {
        this.$api.get(
            'user/show/' + encodeURI(username),
            null, null,
            this.$createListener(callback, "user")
        );
    };

    /**
     * Request the users that a specific user is following
     * http://develop.github.com/p/users.html#following_network
     *
     * @param {String}  username         the username
     */
    this.getFollowing = function(username, callback)
    {
        this.$api.get(
            'user/show/' + encodeURI(username) + "/following",
            null, null,
            this.$createListener(callback, "users")
        );
    };

    /**
     * Request the users following a specific user
     * http://develop.github.com/p/users.html#following_network
     *
     * @param {String}  username         the username
     */
    this.getFollowers = function(username, callback)
    {
        this.$api.get(
            'user/show/' + encodeURI(username) + '/followers',
            null, null,
            this.$createListener(callback, "users")
        );
    },

    /**
     * Update user informations. Requires authentication.
     * http://develop.github.com/p/users.html#authenticated_user_management
     *
     * @param {String}  username         the username to update
     * @param {Object}  data             key, value user attributes to update.
     *                                   key can be name, email, blog, company or location
     */
    this.update = function(username, data, callback)
    {
        var parameters = {};
        for (var key in data) {
            parameters["values[" + key + "]"] = data[key];
        }

        this.$api.post(
            'user/show/' + encodeURI(username),
            parameters, null,
            this.$createListener(callback)
        );
    };

    /**
     * Make the authenticated user follow the specified user. Requires authentication.
     * http://develop.github.com/p/users.html#following_network
     *
     * @param {String}  username         the username to follow
     */
    this.follow = function(username, callback)
    {
        this.$api.post(
            'user/follow/' + encodeURI(username),
            null, null,
            this.$createListener(callback)
        );
    },

    /**
     * Make the authenticated user unfollow the specified user. Requires authentication.
     * http://develop.github.com/p/users.html#following_network
     *
     * @param {String}  username         the username to unfollow
     */
    this.unFollow = function(username, callback)
    {
        this.$api.post(
            'user/unfollow/' + encodeURI(username),
            null, null,
            this.$createListener(callback)
        );
    },

    /**
     * Request the repos that a specific user is watching
     * http://develop.github.com/p/users.html#watched_repos
     *
     * @param {String}  username         the username
     */
    this.getWatchedRepos = function(username, callback)
    {
        this.$api.get(
            'repos/watched/' + encodeURI(username),
            null, null,
            this.$createListener(callback, "repositories")
        );
    },

    /**
     * Get the authenticated user emails. Requires authentication.
     */
    this.getEmails = function(callback)
    {
        this.$api.get(
            "user/emails",
            null, null,
            this.$createListener(callback, "emails")
        );
    },

    /**
     * Add an email to the authenticated user. Requires authentication.
     */
    this.addEmail = function(email, callback)
    {
        this.$api.post(
            'user/email/add',
            {email: email}, null,
            this.$createListener(callback, "emails")
        );
    },

    /**
     * Remove an email from the authenticated user. Requires authentication.
     */
    this.removeEmail = function(email, callback)
    {
        this.$api.post(
            'user/email/remove',
            {email: email}, null,
            this.$createListener(callback, "emails")
        );
    },

    /**
     * Get a list with deploy keys that are set for the authenticated user. Requires authentication.
     */
    this.getKeys = function(callback)
    {
        this.$api.get(
            'user/keys',
            null, null,
            this.$createListener(callback, "public_keys")
        );
    },

    /**
     * Add a public key for the authenticated user. Requires authentication.
     *
     * @param {String} title title of the key
     * @param {String} key   public key data
     */
    this.addKey = function(title, key, callback)
    {
        var parameters = {
            title: title,
            key: key
        };
        this.$api.post(
            'user/key/add',
            parameters, null,
            this.$createListener(callback, "public_keys")
        );
    },

    /**
     * Remove a public key from the authenticated user. Requires authentication.
     *
     * @param {String} id  id of the key to remove
     */
    this.removeKey = function(id, callback)
    {
        this.$api.post(
            'user/key/remove',
            {id: id}, null,
            this.$createListener(callback, "public_keys")
        );
    };

}).call(UserApi.prototype);