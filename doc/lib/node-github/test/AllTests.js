/**
 * Copyright 2010 Ajax.org B.V.
 *
 * This product includes software developed by
 * Ajax.org B.V. (http://www.ajax.org/).
 *
 * Author: Fabian Jaokbs <fabian@ajax.org>
 */

var async_testing = require('../vendor/node-async-testing/async_testing');

var suites = {
    ObjectApi: require("./ObjectApiTest").suite,
    IssueApi: require("./IssueApiTest").suite,
    CommitApi: require("./CommitApiTest").suite,
    RepoApi: require("./RepoApiTest").suite,
    UserApi: require("./UserApiTest").suite,
    GitHubApi: require("./GitHubApiTest").suite,
    Request: require("./RequestTest").suite,
    Authentification: require("./AuthentificationTest").suite
};

if (module === require.main) {
    async_testing.runSuites(suites);
}