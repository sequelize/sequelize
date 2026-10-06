# Contributing to Sequelize

## Introduction

We are happy to see that you might be interested in contributing to Sequelize! There is no need to ask for permission to contribute. For example, anyone can open issues and propose changes to the source code (via pull requests). Here are some ways people can contribute:

- Opening well-written bug reports (via [New Issue](https://github.com/sequelize/sequelize/issues/new/choose))
- Opening well-written feature requests (via [New Issue](https://github.com/sequelize/sequelize/issues/new/choose))
- Proposing improvements to the documentation (via [New Issue](https://github.com/sequelize/sequelize/issues/new/choose))
- Opening pull requests to fix bugs or make other improvements
- Reviewing (i.e., commenting on) open pull requests, to help their creators improve them if needed and allow maintainers to take less time looking into them
- Helping to clarify issues opened by others, commenting and asking for clarification
- Answering [questions tagged with `sequelize.js` on StackOverflow](https://stackoverflow.com/questions/tagged/sequelize.js)
- Helping people in our [public Slack channel](https://sequelize.slack.com/) (note: if you don't have access, get yourself an invite automatically via [this link](https://sequelize.org/slack))

Sequelize is strongly moved by contributions from people like you. All maintainers work on Sequelize in their free time.

If you are using an AI coding agent, point it at [AGENTS.md](./AGENTS.md), which is the agent-facing version of this guide.

## Opening issues

Issues are always very welcome — after all, they are a big part of making Sequelize better. An issue usually describes a bug, feature request, or documentation improvement request.

If you open an issue, try to be as clear as possible. Don't assume that the maintainers will immediately understand the problem. Write your issue in a way that new contributors can also help (add links to helpful resources when applicable).

Make sure you know what an [SSCCE](https://sscce.org/)/[MCVE](https://stackoverflow.com/help/minimal-reproducible-example).

Learn to use [GitHub Flavored Markdown](https://docs.github.com/en/get-started/writing-on-github) to write an issue that is nice to read.

### Opening an issue to report a bug

It is essential that you provide an [SSCCE](https://sscce.org/)/[MCVE](https://stackoverflow.com/help/minimal-reproducible-example) for your issue. You can use the [sequelize-sscce](https://github.com/sequelize/sequelize-sscce) repository. Tell us what the actual (incorrect) behavior is and what should have happened (do not expect the maintainers to know what should happen!). Make sure you have checked that the bug persists in the latest Sequelize version.

If you can even provide a pull request with a failing test (unit test or integration test), that is great! The bug will likely be fixed much faster in this case.

You can also create and execute your SSCCE locally: see [Section 5](#5-running-an-sscce).

### Opening an issue to request a new feature

We're more than happy to accept feature requests! Before we get into how you can bring these to our attention, let's talk about our process for evaluating feature requests:

- A feature request can have three states — _approved_, _pending_ and _rejected_.
  - _Approved_ feature requests are accepted by maintainers as a valuable addition to Sequelize, and are ready to be worked on by anyone.
  - _Rejected_ feature requests were considered not applicable to be a part of the Sequelize ORM. This can change, so feel free to comment on a rejected feature request providing good reasoning and clarification on why it should be reconsidered.
  - _Pending_ feature requests are waiting to be looked at by maintainers. They may or may not need clarification. Contributors can still submit pull requests implementing a pending feature request, if they want, at their own risk of having the feature request rejected (and the pull request closed without being merged).

Please be sure to communicate the following:

1. What problem your feature request aims to solve, or what aspect of the Sequelize workflow it aims to improve.

2. Under what conditions are you anticipating this feature to be most beneficial?

3. Why does it make sense that Sequelize should integrate this feature?

4. See our [Feature Request template](https://github.com/sequelize/sequelize/blob/main/.github/ISSUE_TEMPLATE/feature_request.md) for more details on what to include. Please be sure to follow this template.

If we don't approve your feature request, we'll provide you with our reasoning before closing it out. Some common reasons for denial may include (but are not limited to):

- Something too similar already exists within Sequelize
- This feature seems outside the scope of what Sequelize exists to accomplish

We don't want to deny feature requests that could make our users' lives easier, so please be sure to clearly communicate your goals within your request!

### Opening an issue to request improvements to the documentation

Please state clearly what is missing/unclear/confusing in the documentation. If you have a rough idea of what should be written, please provide a suggestion within the issue.

## Opening a pull request

A pull request is a request for maintainers to "pull" a specific change in code (or documentation) from your copy ("fork") into the repository.

Anyone can open a pull request, there is no need to ask for permission. Maintainers will look at your pull request and tell you if anything else must be done before it can be merged.

The target of the pull request should be the `main` branch (or in rare cases the `v6` branch, if previously agreed with a maintainer).

Please check the _allow edits from maintainers_ box when opening it. Thank you in advance for any pull requests that you open!

If you started to work on something but didn't finish it yet, you can open a draft pull request if you want (by choosing the "draft" option). Maintainers will know that it's not ready to be reviewed yet.

A pull request should mention in its description one or more issues that it addresses. If your pull request does not address any existing issue, explain in its description what it is doing — you are also welcome to write an issue first, and then mention this new issue in the PR description.

If your pull request implements a new feature, it's better if the feature was already explicitly approved by a maintainer, otherwise you are taking the risk of having the feature request rejected later and your pull request closed without being merged.

Once you open a pull request, our automated checks will run (they take a few minutes). Make sure they are all passing. If they're not, make new commits to your branch fixing that, and the pull request will pick them up automatically and rerun our automated checks.

_Note:_ if you believe a test failed for a reason completely unrelated to your changes, it could be a rare situation of a _flaky test_ that is not your fault, and if that is indeed the case, and everything else passed, a maintainer will ignore the _flaky test_ and merge your pull request, so don't worry.

A pull request that fixes a bug or implements a new feature must add at least one automated test that:

- Passes
- Would not pass if executed without your implementation

## How to prepare a development environment for Sequelize

### 0. Requirements

Most operating systems provide all the needed tools (including Windows, Linux and macOS):

- Mandatory:

  - [Node.js](https://nodejs.org) 22, 24 or 26. CI tests all three; the lint, typings and docs jobs run Node 24. `@sequelize/core` declares `"node": "^22.13.0 || >=24.0.0"`
  - [Git](https://git-scm.com/)

- Optional (recommended):

  - [Docker](https://docs.docker.com/get-docker/) and [Docker Compose Plugin](https://docs.docker.com/compose/install/)
    - It is not mandatory because you can easily locally run tests against SQLite without it.
    - It is practically mandatory if you want to locally run tests against any other database engine (MySQL, MariaDB, Postgres, MSSQL, Db2 and Oracle), unless you happen to have the engine installed and are willing to make some manual configuration.
  - [Visual Studio Code](https://code.visualstudio.com/)
    - [EditorConfig extension](https://marketplace.visualstudio.com/items?itemName=EditorConfig.EditorConfig)
      - Also run `npm install --global editorconfig` to make sure this extension will work properly
    - [ESLint extension](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
    - [Prettier extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

### 1. Clone the repository

Clone the repository (if you haven't already) via `git clone https://github.com/sequelize/sequelize`. If you plan on submitting a pull request, you can create a fork by clicking the _fork_ button and clone it instead with `git clone https://github.com/your-github-username/sequelize`, or add your fork as an extra remote on the already cloned repo with `git remote add fork https://github.com/your-github-username/sequelize`.

### 2. Install the Node.js dependencies

Run `yarn install` within the cloned repository folder to install the dependencies.

Once installed, run the `yarn build` command to build the project.

If you change what a dialect or utility package exports, run `yarn sync-exports` in that package: its `src/index.ts` is generated, and the file says so in a header comment. `@sequelize/core` and `@sequelize/validator.js` are different — their `src/index.mjs` is hand-written, so update it yourself and check it with `yarn test-unit-esm`.

#### 2.1 Adding and updating dependencies

[Yarn v4](https://yarnpkg.com/) is used in the CI/CD pipeline, so adding and updating dependencies must be done with Yarn.

#### 2.2 Running commands

Sequelize is a monorepo and uses `lerna` to run scripts in each of the packages. The syntax for the commands is: `yarn lerna run` followed by the script name. For example:

```bash
yarn lerna run test-unit
```

By default, the `yarn lerna run` command will run the script in all packages which have a matching script. By appending `--scope=package_name` to the command (where `package_name` is the name of the package you want to run the script on), you can select a specific package to run the script on. For example:

```bash
yarn lerna run test-unit --scope=@sequelize/core
```

Lerna caching is enabled for the following commands:

- `yarn build`
- `yarn test-typings`
- `yarn test-unit`

Currently, the caching is configured to watch the `src` folder and `package.json` and `tsconfig.json` files in each package for production changes and all files in each package for default changes.

This means that running the `yarn build` command and not making changes to the production files (see above), the output of the command is loaded from the cache rather than the command being executed. When running `yarn test-typings` or `yarn test-unit`, any changes in the package folder will cause the command to run rather than the results loaded from cache.

If you run into any issues with the cache, running the command `yarn nx reset` will reset the cache.

For more information about using `lerna` commands, see the [Lerna documentation](https://lerna.js.org/docs/api-reference/commands).

### 3. Prepare local databases to run tests

If you're happy to run tests only against an SQLite database, you can skip this section.

#### 3.1. With Docker (recommended)

If you have Docker installed, use any of the following commands to start a fresh local database for the dialect of your choice:

- `yarn start-mariadb-oldest` or `yarn start-mariadb-latest`
- `yarn start-mysql-oldest` or `yarn start-mysql-latest`
- `yarn start-postgres-oldest` or `yarn start-postgres-latest`
- `yarn start-mssql-oldest` or `yarn start-mssql-latest`
- `yarn start-db2-oldest` or `yarn start-db2-latest`
- `yarn start-oracle-oldest` or `yarn start-oracle-latest`

Each pair matches the oldest and latest version of that database that Sequelize supports, which is what CI runs against. For the exact image tag, see `dev/<dialect>/<oldest|latest>/docker-compose.yml` — these versions change over time, so treat the compose files as the source of truth. The Postgres images are PostGIS-enabled, which the geometry tests need.

`yarn start-oldest` and `yarn start-latest` start every dialect at once.

Db2 for i and Snowflake have no local Docker service; running those suites needs an external server.

_Note:_ if you're using Windows, make sure you run these from Git Bash (or another MinGW environment), since these commands will execute bash scripts. Recall that [it's very easy to include Git Bash as your default integrated terminal in Visual Studio Code](https://code.visualstudio.com/docs/editor/integrated-terminal).

Each of these commands will start a Docker container with the corresponding database, ready to run Sequelize tests (or an SSCCE).

You can run `yarn stop-<dialect>` to stop the servers once you're done, or `yarn stop-all` to stop every one of them.

The Docker containers retain storage in volumes to improve startup time. If you run into any issues with a container, you can run `yarn reset-{dialect}` or `yarn reset-all` to remove the containers and volumes.

##### Hint for Postgres

You can also easily start a local [pgAdmin 4](https://www.pgadmin.org/docs/pgadmin4/latest/) instance at `localhost:8888` to inspect the contents of the test Postgres database as follows:

```bash
docker run -d --name pgadmin4 -p 8888:80 -e 'PGADMIN_DEFAULT_EMAIL=test@example.com' -e 'PGADMIN_DEFAULT_PASSWORD=sequelize_test' dpage/pgadmin4
```

#### 3.2. Without Docker

You will have to manually install and configure each database engine you want to test against. Check the `dev/<dialect>/<oldest|latest>` folders within this repository and look carefully at how it is defined via Docker and via the auxiliary bash script, and mimic that exactly (except for the database name, username, password, host and port, which you can customize via the `SEQ_DB`, `SEQ_USER`, `SEQ_PW`, `SEQ_HOST` and `SEQ_PORT` environment variables, respectively). Please refer to the [Version Policy](https://sequelize.org/releases/) for the oldest supported version of each database.

### 4. Running tests

Before starting any work, try to run the tests locally to be sure your setup is fine. Start by running the SQLite tests:

```bash
yarn lerna run test-sqlite3
```

Then, if you want to run tests for another dialect, assuming you've set it up as described in [Section 3](#3-prepare-local-databases-to-run-tests), run the corresponding command:

- `yarn lerna run test-mysql`
- `yarn lerna run test-mariadb`
- `yarn lerna run test-postgres`
- `yarn lerna run test-postgres-native`
- `yarn lerna run test-mssql`
- `yarn lerna run test-db2`
- `yarn lerna run test-oracle`
- `yarn lerna run test-ibmi` (needs an external Db2 for i server; see above)

There are also the `test-unit-*` and `test-integration-*` sets of scripts (for example, `test-integration-postgres`).

_Note:_ when running these tests, you will need to run `yarn build` after you have made changes to the source code for these changes to affect the tests. The `yarn lerna run test-{dialect}` command does this for you.

#### 4.1. Running only some tests

While you're developing, you may want to execute only a single test (or a few) instead of everything, which takes some time. Navigate to the package's root directory — where its `package.json` lives, for example [packages/core](./packages/core) — and pass the test file straight to Mocha:

```bash
cd packages/core
DIALECT=postgres yarn mocha test/integration/utils.test.ts
```

Add `--grep` to narrow it further. You can also set `spec` and `grep` in the repository-root `.mocharc.jsonc` instead (but don't commit those changes!); Mocha finds it by walking up from the directory you run in.

_Hint:_ if you're creating a new test, you can run just that test against every dialect you have running locally (see [Section 3.1](#31-with-docker-recommended)) from the package's root directory:

```bash
DIALECT=mariadb yarn mocha test/integration/your-new.test.ts && DIALECT=mysql yarn mocha test/integration/your-new.test.ts && DIALECT=postgres yarn mocha test/integration/your-new.test.ts && DIALECT=sqlite3 yarn mocha test/integration/your-new.test.ts && DIALECT=mssql yarn mocha test/integration/your-new.test.ts && DIALECT=db2 yarn mocha test/integration/your-new.test.ts
```

### 5. Running an SSCCE

What is an SSCCE? [Find out here](https://www.sscce.org/).

You can modify the `sscce.ts` file (at the root of the repository) to create an SSCCE.

Run it for the dialect of your choice using one of the following commands:

- `npm run sscce-mariadb` / `yarn sscce-mariadb`
- `npm run sscce-mysql` / `yarn sscce-mysql`
- `npm run sscce-postgres` / `yarn sscce-postgres`
- `npm run sscce-sqlite3` / `yarn sscce-sqlite3`
- `npm run sscce-mssql` / `yarn sscce-mssql`
- `npm run sscce-db2` / `yarn sscce-db2`
- `npm run sscce-oracle` / `yarn sscce-oracle`
- `npm run sscce-postgres-native` / `yarn sscce-postgres-native`

_Note:_ first, you need to set up (once) the database instance for the corresponding dialect, as explained in [Section 3.1](#31-with-docker-recommended).

#### 5.1. Debugging an SSCCE with Visual Studio Code

If you open the `package.json` file with Visual Studio Code, you will find a small `debug` button rendered right above the `"scripts": {` line. Click it, and a popup will appear where you can choose which script you want to debug. Select one of the `sscce-*` scripts (listed above) and VSCode will immediately launch your SSCCE in debug mode (meaning that it will stop on any breakpoints that you place within `sscce.ts` or any other Sequelize source code).

### 6. Commit your modifications

We squash all commits into a single one when we merge your PR.
That means you don't have to follow any convention in your commit messages,
but you will need to follow the [Conventional Commits Conventions](https://www.conventionalcommits.org/en/v1.0.0/) when writing the title of your PR.

We will then use the title of your PR as the message of the squash commit. It will then be used to automatically generate a changelog and calculate the next [semver](https://semver.org/) version number.

We use a simple conventional commits convention:

- The allowed commit types are: `docs`, `feat`, `fix`, `meta`.
- We allow the following commit scopes (they're the list of packages):
  - `core`
  - `utils`
  - `cli`
  - `validator.js`
  - `postgres`
  - `mysql`
  - `mariadb`
  - `sqlite3`
  - `mssql`
  - `db2`
  - `ibmi`
  - `oracle`
  - `snowflake`
- If your changes impact more than one scope, simply omit the scope.

Example:

```text
feat(postgres): support specifying a custom name for enums
```

Happy hacking and thank you for contributing.

## Coding guidelines

Sequelize uses ESLint and Prettier to enforce a consistent coding style.
We recommend configuring them in your IDE to automatically format your code on save.

You can format your code at any point by running `yarn format`.
Any issue not automatically fixed by this command will be printed to the console.

To reproduce CI's lint job, run `yarn test:format`, which checks formatting without writing any changes.

## Contributing to the documentation

For contribution guidelines for the documentation, see [CONTRIBUTING.DOCS.md](https://github.com/sequelize/sequelize/blob/main/CONTRIBUTING.DOCS.md).
