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

var IssueApi = exports.IssueApi = function(api) {
    this.$api = api;
};

sys.inherits(IssueApi, AbstractApi);

(function() {
    /**
     * List issues by username, repo and state
     * http://develop.github.com/p/issues.html#list_a_projects_issues
     *
     * @param {String}  username         the username
     * @param {String}  repo             the repo
     * @param {String}  $state            the issue state, can be open or closed
     */
    this.getList = function(username, repo, state, callback)
    {
        var state = state || "open";
        this.$api.get(
            'issues/list/' + encodeURI(username) + "/" + encodeURI(repo) + "/" + encodeURI(state),
            null, null,
            this.$createListener(callback, "issues")
        );
    };

}).call(IssueApi.prototype);

//
///**
// * Search issues by username, repo, state and search term
// * http://develop.github.com/p/issues.html#list_a_projects_issues
// *
// * @param {String}  username         the username
// * @param {String}  repo             the repo
// * @param {String}  $state            the issue state, can be open or closed
// * @param {String}  $searchTerm       the search term to filter issues by
// */
//this.search = function(username, repo, $state, $searchTerm)
//{
//  $response = $this->api->get('issues/search/'.urlencode(username).'/'.urlencode(repo).'/'.urlencode($state).'/'.urlencode($searchTerm));
//
//  return $response['issues'];
//}
//
///**
// * Get extended information about an issue by its username, repo and number
// * http://develop.github.com/p/issues.html#view_an_issue
// *
// * @param {String}  username         the username
// * @param {String}  repo             the repo
// * @param {String}  issueNumber      the issue number
// */
//this.show = function(username, repo, issueNumber)
//{
//  $response = $this->api->get('issues/show/'.urlencode(username).'/'.urlencode(repo).'/'.urlencode(issueNumber));
//
//  return $response['issue'];
//}
//
///**
// * Create a new issue for the given username and repo.
// * The issue is assigned to the authenticated user. Requires authentication.
// * http://develop.github.com/p/issues.html#open_and_close_issues
// *
// * @param {String}  username         the username
// * @param {String}  repo             the repo
// * @param {String}  $issueTitle       the new issue title
// * @param {String}   $issueBody       the new issue body
// */
//this.open = function(username, repo, $issueTitle, $issueBody)
//{
//  $response = $this->api->post('issues/open/'.urlencode(username).'/'.urlencode(repo), array(
//    'title' => $issueTitle,
//    'body'  => $issueBody
//  ));
//
//  return $response['issue'];
//}
//
///**
// * Close an existing issue by username, repo and issue number. Requires authentication.
// * http://develop.github.com/p/issues.html#open_and_close_issues
// *
// * @param {String}  username         the username
// * @param {String}  repo             the repo
// * @param {String}  issueNumber      the issue number
// */
//this.close = function(username, repo, issueNumber)
//{
//  $response = $this->api->post('issues/close/'.urlencode(username).'/'.urlencode(repo).'/'.urlencode(issueNumber));
//
//  return $response['issue'];
//}
//
///**
// * Update issue informations by username, repo and issue number. Requires authentication.
// * http://develop.github.com/p/issues.html#edit_existing_issues
// *
// * @param {String}  username         the username
// * @param {String}  repo             the repo
// * @param {String}  issueNumber      the issue number
// * @param   array   $data             key=>value user attributes to update.
// *                                    key can be title or body
// */
//this.update = function(username, repo, issueNumber, array $data)
//{
//  $response = $this->api->post('issues/edit/'.urlencode(username).'/'.urlencode(repo).'/'.urlencode(issueNumber), $data);
//
//  return $response['issue'];
//}
//
///**
// * Repoen an existing issue by username, repo and issue number. Requires authentication.
// * http://develop.github.com/p/issues.html#open_and_close_issues
// *
// * @param {String}  username         the username
// * @param {String}  repo             the repo
// * @param {String}  issueNumber      the issue number
// */
//this.reOpen = function(username, repo, issueNumber)
//{
//  $response = $this->api->post('issues/reopen/'.urlencode(username).'/'.urlencode(repo).'/'.urlencode(issueNumber));
//
//  return $response['issue'];
//}
//
///**
// * List an issue comments by username, repo and issue number
// * http://develop.github.com/p/issues.html#list_an_issues_comments
// *
// * @param {String}  username         the username
// * @param {String}  repo             the repo
// * @param {String}  issueNumber      the issue number
// */
//this.getComments = function(username, repo, issueNumber)
//{
//  $response = $this->api->get('issues/comments/'.urlencode(username).'/'.urlencode(repo).'/'.urlencode(issueNumber));
//
//  return $response['comments'];
//}
//
///**
// * Add a comment to the issue by username, repo and issue number
// * http://develop.github.com/p/issues.html#comment_on_issues
// *
// * @param {String}  username         the username
// * @param {String}  repo             the repo
// * @param {String}  issueNumber      the issue number
// * @param {String}  $comment          the comment body
// */
//this.addComment = function(username, repo, issueNumber, $commentBody)
//{
//  $response = $this->api->post('issues/comment/'.urlencode(username).'/'.urlencode(repo).'/'.urlencode(issueNumber), array(
//    'comment' => $commentBody
//  ));
//
//  return $response['comment'];
//}
//
///**
// * List all project labels by username and repo
// * http://develop.github.com/p/issues.html#listing_labels
// *
// * @param {String}  username         the username
// * @param {String}  repo             the repo
// */
//this.getLabels = function(username, repo)
//{
//  $response = $this->api->get('issues/labels/'.urlencode(username).'/'.urlencode(repo));
//
//  return $response['labels'];
//}
//
///**
// * Add a label to the issue by username, repo and issue number. Requires authentication.
// * http://develop.github.com/p/issues.html#add_and_remove_labels
// *
// * @param {String}  username         the username
// * @param {String}  repo             the repo
// * @param {String}  issueNumber      the issue number
// * @param {String}  labelName        the label name
// */
//this.addLabel = function(username, repo, labelName, issueNumber)
//{
//  $response = $this->api->post('issues/label/add/'.urlencode(username).'/'.urlencode(repo).'/'.urlencode(labelName).'/'.urlencode(issueNumber));
//
//  return $response['labels'];
//}
//
///**
// * Remove a label from the issue by username, repo, issue number and label name. Requires authentication.
// * http://develop.github.com/p/issues.html#add_and_remove_labels
// *
// * @param {String}  username         the username
// * @param {String}  repo             the repo
// * @param {String}  issueNumber      the issue number
// * @param {String}  labelName        the label name
// */
//this.removeLabel = function(username, repo, labelName, issueNumber)
//{
//  $response = $this->api->post('issues/label/remove/'.urlencode(username).'/'.urlencode(repo).'/'.urlencode(labelName).'/'.urlencode(issueNumber));
//
//  return $response['labels'];
//}