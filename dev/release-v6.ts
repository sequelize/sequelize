/**
 * Merges all the to be released commits into the v6 branch and pushes it to the remote.
 * The push will then trigger the release process via the GitHub Action workflow.
 * 
 * Main branch must be up-to-date. To be executed on the target branch.
 *
 * Usage:
 * DRY_RUN=<Boolean> GITHUB_TOKEN=<PAT> node_modules/.bin/ts-node dev/release-v6.ts
 */

import { Octokit } from "@octokit/rest";
import { Endpoints } from "@octokit/types";
import { execSync } from "child_process";

type Card =
  Endpoints["GET /projects/columns/cards/{card_id}"]["response"]["data"];
type PullRequest =
  Endpoints["GET /repos/{owner}/{repo}/pulls/{pull_number}"]["response"]["data"];

const OWNER = "sequelize";
const REPO = "sequelize";
const TO_BE_RELEASED_COLUMN_ID = 17352881;

(async () => {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    console.error("GITHUB_TOKEN variable is not set");
    process.exit(1);
  }

  const github = new Octokit({
    auth: token,
  });
  const commits = await getCommitsFromProject(github);

  await Promise.all(commits.map(mergeCommit));
})();

// Helpers

async function getCommitsFromProject(github: Octokit): Promise<PullRequest[]> {
  const cards = await github.rest.projects.listCards({
    column_id: TO_BE_RELEASED_COLUMN_ID,
  });

  const commits = await Promise.all(
    cards.data
      .filter(isIssueCard)
      .map((card) => cardToMergedCommit(github, card))
  );

  return commits.filter(Boolean) as PullRequest[];
}

function isIssueCard(card: Card) {
  return card.content_url?.includes("/issues/");
}

async function cardToMergedCommit(
  github: Octokit,
  card: Card
): Promise<PullRequest | undefined> {
  const issueNumber = card.content_url?.split("/").pop();
  const { data: pullRequest } = await github.pulls.get({
    owner: OWNER,
    repo: REPO,
    pull_number: Number(issueNumber),
  });

  if (!pullRequest?.merged) {
    return;
  }

  return pullRequest;
}

async function mergeCommit(commit: PullRequest) {
  mergeCommitTeaser(commit);

  if (commit.merge_commit_sha) {
    await gitMerge(commit.merge_commit_sha);
  }
}

function mergeCommitTeaser(commit: PullRequest) {
  console.info();
  console.info("Merging commit:", commit.title);
  console.info("- Commit SHA:", commit.merge_commit_sha);
  console.info("- Commit URL:", commit.html_url);
}

async function gitMerge(sha: string) {
  const gitCommand = `git cherry-pick ${sha}`;

  console.info("- Git command:", gitCommand);

  if (process.env.DRY_RUN === "false") {
    execSync(gitCommand, { stdio: "inherit" });
  }
}
