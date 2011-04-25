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

suite.setup(function() {
    this.github = new GitHubApi(true);
    this.issueApi = this.github.getIssueApi();
});

suite.addTests({
    "test: list issues" : function(assert, finished, test) {
        test.issueApi.getList(username, repo, "closed", function(err, issues) {
            assert.equal(issues[0].state, "closed");
            finished();
        });
    }
});

if (module === require.main) {
    async_testing.runSuites({IssueApi: suite});
}

//$t->is_deeply($github->listIssues($username, $repo, 'closed'), $issues, 'Both new and BC syntax work');
//
//$t->comment('Search issues');
//
//$issues = $github->getIssueApi()->search($username, $repo, 'closed', 'documentation');
//
//$t->is($issues[0]['state'], 'closed', 'Found closed issues matching "documentation"');
//
//$t->is_deeply($github->searchIssues($username, $repo, 'closed', 'documentation'), $issues, 'Both new and BC syntax work');
//
//$t->comment('Show issue');
//
//$issue = $github->getIssueApi()->show($username, $repo, 1);
//
//$t->is($issue['title'], 'Provide documentation', 'Found issue #1');
//
//$t->is_deeply($github->showIssue($username, $repo, 1), $issue, 'Both new and BC syntax work');
//
//$username = 'ornicartest';
//$token    = 'fd8144e29b4a85e9487d1cacbcd4e26c';
//$repo     = 'php-github-api';
//
//$t->comment('Authenticate '.$username);
//
//$github->authenticate($username, $token);
//
//$t->comment('Open a new issue');
//
//$issueTitle = 'Test new issue title '.time();
//$issue = $github->getIssueApi()->open($username, $repo, $issueTitle, 'Test new issue body');
//
//$t->is($issue['title'], $issueTitle, 'Got the new issue');
//$t->is($issue['state'], 'open', 'The new issue is open');
//
//$issueNumber = $issue['number'];
//
//$t->comment('Close the issue');
//
//$issue = $github->getIssueApi()->close($username, $repo, $issueNumber);
//
//$t->is($issue['state'], 'closed', 'The new issue is closed');
//
//$t->comment('Reopen the issue');
//
//$issue = $github->getIssueApi()->reOpen($username, $repo, $issueNumber);
//
//$t->is($issue['state'], 'open', 'The new issue is open');
//
//$t->comment('Update the issue');
//
//$issue = $github->getIssueApi()->update($username, $repo, $issueNumber, array(
//  'body' => 'Test new issue body updated'
//));
//
//$t->is($issue['body'], 'Test new issue body updated', 'The issue has been updated');
//
//$t->comment('Add an issue comment');
//$commentText = 'This is a test comment';
//
//$comment = $github->getIssueApi()->addComment($username, $repo, $issueNumber, $commentText);
//
//$t->is($comment['comment'], $commentText, 'Got the new comment');
//
//$t->comment('List issue comments');
//
//$comments = $github->getIssueApi()->getComments($username, $repo, $issueNumber);
//
//$t->is($comments[0]['body'], $commentText, 'Found the new comment');
//
//$t->comment('Add a label to the issue');
//$labelName = 'testing';
//
//$labels = $github->getIssueApi()->addLabel($username, $repo, $labelName, $issueNumber);
//
//$t->ok(in_array($labelName, $labels), 'The issue now has the label '.$labelName);
//
//$t->comment('Remove a label from the issue');
//
//$labels = $github->getIssueApi()->removeLabel($username, $repo, $labelName, $issueNumber);
//
//$t->ok(!in_array($labelName, $labels), 'The issue has no more label '.$labelName);
//
//$t->comment('List project labels');
//
//$labels = $github->getIssueApi()->getLabels($username, $repo);
//
//$t->ok(in_array($labelName, $labels), 'The project has the label '.$labelName);