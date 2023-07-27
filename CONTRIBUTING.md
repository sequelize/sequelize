# Introduction

We are happy to see that you might be interested in contributing to Sequelize! There is no need to ask for permission to contribute. For example, anyone can open issues and propose changes to the source code (via Pull Requests). Here are some ways people can contribute:

- Opening well-written bug reports (via [New Issue](https://github.com/sequelize/sequelize/issues/new/choose))
- Opening well-written feature requests (via [New Issue](https://github.com/sequelize/sequelize/issues/new/choose))
- Proposing improvements to the documentation (via [New Issue](https://github.com/sequelize/sequelize/issues/new/choose))
- Opening Pull Requests to fix bugs or make other improvements
- Reviewing (i.e. commenting on) open Pull Requests, to help their creators improve it if needed and allow maintainers to take less time looking into them
- Helping to clarify issues opened by others, commenting and asking for clarification
- Answering [questions tagged with `sequelize.js` on StackOverflow](https://stackoverflow.com/questions/tagged/sequelize.js)
- Helping people in our [public Slack channel](https://sequelize.slack.com/) (note: if you don't have access, get yourself an invite automatically via [this link](https://sequelize.org/slack))

Sequelize is strongly moved by contributions from people like you. All maintainers also work on their free time here.

## Opening Issues

Issues are always very welcome - after all, they are a big part of making Sequelize better. An issue usually describes a bug, feature request, or documentation improvement request.

If you open an issue, try to be as clear as possible. Don't assume that the maintainers will immediately understand the problem. Write your issue in a way that new contributors can also help (add links to helpful resources when applicable).

Make sure you know what is an [SSCCE](http://sscce.org/)/[MCVE](https://stackoverflow.com/help/minimal-reproducible-example).

Learn to use [GitHub flavored markdown](https://help.github.com/articles/github-flavored-markdown) to write an issue that is nice to read.

### Opening an issue to report a bug

It is essential that you provide an [SSCCE](http://sscce.org/)/[MCVE](https://stackoverflow.com/help/minimal-reproducible-example) for your issue. You can use the [papb/sequelize-sscce](https://github.com/papb/sequelize-sscce) repository. Tell us what is the actual (incorrect) behavior and what should have happened (do not expect the maintainers to know what should happen!). Make sure you checked the bug persists in the latest Sequelize version.

If you can even provide a Pull Request with a failing test (unit test or integration test), that is great! The bug will likely be fixed much faster in this case.

You can also create and execute your SSCCE locally: see [Section 5](https://github.com/sequelize/sequelize/blob/main/CONTRIBUTING.md#running-an-sscce).

### Opening an issue to request a new feature

We're more than happy to accept feature requests! Before we get into how you can bring these to our attention, let's talk about our process for evaluating feature requests:

- A feature request can have three states - _approved_, _pending_ and _rejected_.
  - _Approved_ feature requests are accepted by maintainers as a valuable addition to Sequelize, and are ready to be worked on by anyone.
  - _Rejected_ feature requests were considered not applicable to be a part of the Sequelize ORM. This can change, so feel free to comment on a rejected feature request providing a good reasoning and clarification on why it should be reconsidered.
  - _Pending_ feature requests are waiting to be looked at by maintainers. They may or may not need clarification. Contributors can still submit pull requests implementing a pending feature request, if they want, at their own risk of having the feature request rejected (and the pull request closed without being merged).

Please be sure to communicate the following:

1. What problem your feature request aims to solve OR what aspect of the Sequelize workflow it aims to improve.

2. Under what conditions are you anticipating this feature to be most beneficial?

3. Why does it make sense that Sequelize should integrate this feature?

4. See our [Feature Request template](https://github.com/sequelize/sequelize/blob/main/.github/ISSUE_TEMPLATE/feature_request.md) for more details on what to include. Please be sure to follow this template.

If we don't approve your feature request, we'll provide you with our reasoning before closing it out. Some common reasons for denial may include (but are not limited to):

- Something too similar to already exists within Sequelize
- This feature seems out of scope of what Sequelize exists to accomplish

We don't want to deny feature requests that could potentially make our users lives easier, so please be sure to clearly communicate your goals within your request!

### Opening an issue to request improvements to the documentation

Please state clearly what is missing/unclear/confusing in the documentation. If you have a rough idea of what should be written, please provide a suggestion within the issue.

## Opening a Pull Request

A Pull Request is a request for maintainers to "pull" a specific change in code (or documentation) from your copy ("fork") into the repository.

Anyone can open a Pull Request, there is no need to ask for permission. Maintainers will look at your pull request and tell you if anything else must be done before it can be merged.

The target of the Pull Request should be the `main` branch (or in rare cases the `v5` branch, if previously agreed with a maintainer).

Please check the _allow edits from maintainers_ box when opening it. Thank you in advance for any pull requests that you open!

If you started to work on something but didn't finish it yet, you can open a draft pull request if you want (by choosing the "draft" option). Maintainers will know that it's not ready to be reviewed yet.

A pull request should mention in its description one or more issues that is addresses. If your pull request does not address any existing issue, explain in its description what it is doing - you are also welcome to write an issue first, and then mention this new issue in the PR description.

If your pull request implements a new feature, it's better if the feature was already explicitly approved by a maintainer, otherwise you are taking the risk of having the feature request rejected later and your pull request closed without merge.

Once you open a pull request, our automated checks will run (they take a few minutes). Make sure they are all passing. If they're not, make new commits to your branch fixing that, and the pull request will pick them up automatically and rerun our automated checks.

Note: if you believe a test failed but is completely unrelated to your changes, it could be a rare situation of a _flaky test_ that is not your fault, and if it's indeed the case, and everything else passed, a maintainer will ignore the _flaky test_ and merge your pull request, so don't worry.

A pull request that fixes a bug or implements a new feature must add at least one automated test that:

- Passes
- Would not pass if executed without your implementation

## How to prepare a development environment for Sequelize

### 0. Requirements

Most operating systems provide all the needed tools (including Windows, Linux and MacOS):

- Mandatory:

  - [Node.js](http://nodejs.org), it is preferred to use the current LTS version of Node
  - [Git](https://git-scm.com/)

- Optional (recommended):

  - [Docker](https://docs.docker.com/get-docker/) and [Docker Compose Plugin](https://docs.docker.com/compose/install/)
    - It is not mandatory because you can easily locally run tests against SQLite without it.
    - It is practically mandatory if you want to locally run tests against any other database engine (MySQL, MariaDB, Postgres,Db2 and MSSQL), unless you happen to have the engine installed and is willing to make some manual configuration.
  - [Visual Studio Code](https://code.visualstudio.com/)
    - [EditorConfig extension](https://marketplace.visualstudio.com/items?itemName=EditorConfig.EditorConfig)
      - Also run `npm install --global editorconfig` (or `yarn global add editorconfig`) to make sure this extension will work properly
    - [ESLint extension](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)

### 1. Clone the repository

Clone the repository (if you haven't already) via `git clone https://github.com/sequelize/sequelize`. If you plan on submitting a pull request, you can create a fork by clicking the _fork_ button and clone it instead with `git clone https://github.com/your-github-username/sequelize`, or add your fork as an upstream on the already cloned repo with `git remote add upstream https://github.com/your-github-username/sequelize`.

### 2. Install the Node.js dependencies

Run `yarn install` within the cloned repository folder.

#### 2.1 Adding and updating dependencies

[Yarn v3](https://yarnpkg.com//) is used in the CI/CD pipeline so adding and updating dependencies must be done with Yarn.

### 3. Prepare local databases to run tests

If you're happy to run tests only against an SQLite database, you can skip this section.

#### 3.1. With Docker (recommended)

If you have Docker installed, use any of the following commands to start fresh local databases of the dialect of your choice:

- `yarn start-mariadb-oldest` (for MariaDB 10.4) or `yarn start-mariadb-latest` (for MariaDB 11.0)
- `yarn start-mysql-oldest` (for MySQL 5.7) or `yarn start-mysql-latest` (for MySQL 8.0)
- `yarn start-postgres-oldest` (for Postgres 11) or `yarn start-postgres-latest` (for Postgres 15)
- `yarn start-mssql-oldest` (for MSSQL 2017) or `yarn start-mssql-latest` (for MSSQL 2022)
- `yarn start-db2-oldest` (for Db2 11.5.5.1) or `yarn start-db2-latest` (for Db2 11.5.8.0)

_Note:_ if you're using Windows, make sure you run these from Git Bash (or another MinGW environment), since these commands will execute bash scripts. Recall that [it's very easy to include Git Bash as your default integrated terminal on Visual Studio Code](https://code.visualstudio.com/docs/editor/integrated-terminal).

Each of these commands will start a Docker container with the corresponding database, ready to run Sequelize tests (or an SSCCE).

You can run `yarn stop-X` to stop the servers once you're done.

##### Hint for Postgres

You can also easily start a local [pgadmin4](https://www.pgadmin.org/docs/pgadmin4/latest/) instance at `localhost:8888` to inspect the contents of the test Postgres database as follows:

```
docker run -d --name pgadmin4 -p 8888:80 -e 'PGADMIN_DEFAULT_EMAIL=test@example.com' -e 'PGADMIN_DEFAULT_PASSWORD=sequelize_test' dpage/pgadmin4
```

#### 3.2. Without Docker

You will have to manually install and configure each of database engines you want. Check the `dev/dialect-name` folder within this repository and look carefully at how it is defined via Docker and via the auxiliary bash script, and mimic that exactly (except for the database name, username, password, host and port, that you can customize via the `SEQ_DB`, `SEQ_USER`, `SEQ_PW`, `SEQ_HOST` and `SEQ_PORT` environment variables, respectively). Please refer to the [Version Policy](https://sequelize.org/releases/) for the oldest supported version of each database.

### 4. Running tests

Sequelize is a monorepo and uses `lerna` to run scripts in each of the packages. The syntax for the commands is: `yarn lerna run` followed by the script name. For example:

```
yarn lerna run test-unit
```

By default, the `yarn lerna run` command will run the script in all packages which have a matching script. By appending `--scope=package_name` to the command (where `package_name` is the name of the package you want to run the script on) you can select a specific package to run the script on. For example:

```
yarn lerna run test-unit --scope=@sequelize/core
```

For more information about using `lerna` commands, use the [Lerna Documentation](https://lerna.js.org/docs/api-reference/commands).

Before starting any work, try to run the tests locally in order to be sure your setup is fine. Start by running the SQLite tests:

```
yarn lerna run test-sqlite
```

Then, if you want to run tests for another dialect, assuming you've set it up as written on section 3, run the corresponding command:

- `yarn lerna run test-mysql`
- `yarn lerna run test-mariadb`
- `yarn lerna run test-postgres`
- `yarn lerna run test-mssql`
- `yarn lerna run test-db2`

There are also the `test-unit-*` and `test-integration-*` sets of scripts (for example, `test-integration-postgres`).

#### 4.1. Running only some tests

While you're developing, you may want to execute only a single test (or a few), instead of executing everything (which takes some time). You can easily achieve this by modifying the `.mocharc.jsonc` file inside the package's root directory (but don't commit those changes!) to use `spec` (and maybe `grep`) from Mocha to specify the desired tests. Then, from your terminal, navigate to the package's root directory and simply call `DIALECT=some-dialect yarn mocha` (example: `DIALECT=postgres yarn mocha`). The package root directory is where the package.json file for the package is located. For example with the @sequelize/core package, the package root directory is [packages/core](https://github.com/sequelize/sequelize/tree/main/packages/core).

Hint: if you're creating a new test, you can execute only that test locally against all dialects by adapting the `spec` and `grep` options on `.mocharc.jsonc` and running the following from your terminal (assuming you already set up the database instances via the corresponding `yarn setup-*` calls, as explained on [Section 3a](https://github.com/sequelize/sequelize/blob/main/CONTRIBUTING.md#3a-with-docker-recommended) and you are in the package's root directory):

```
DIALECT=mariadb yarn mocha && DIALECT=mysql yarn mocha && DIALECT=postgres yarn mocha && DIALECT=sqlite yarn mocha && DIALECT=mssql yarn mocha && DIALECT=db2 yarn mocha
```

### 5. Running an SSCCE

What is SSCCE? [find out here](http://www.sscce.org/).

You can modify the `sscce.js` file (at the root of the repository) to create an SSCCE.

Run it for the dialect of your choice using one of the following commands:

- `npm run sscce-mariadb` / `yarn sscce-mariadb`
- `npm run sscce-mysql` / `yarn sscce-mysql`
- `npm run sscce-postgres` / `yarn sscce-postgres`
- `npm run sscce-sqlite` / `yarn sscce-sqlite`
- `npm run sscce-mssql` / `yarn sscce-mssql`
- `npm run sscce-db2` / `yarn sscce-db2`

_Note:_ First, you need to set up (once) the database instance for corresponding dialect, as explained on [Section 3a](https://github.com/sequelize/sequelize/blob/main/CONTRIBUTING.md#3a-with-docker-recommended).

#### 5.1. Debugging an SSCCE with Visual Studio Code

If you open the `package.json` file with Visual Studio Code, you will find a small `debug` button rendered right above the `"scripts": {` line. By clicking it, a popup will appear where you can choose which script you want to debug. Select one of the `sscce-*` scripts (listed above) and VSCode will immediately launch your SSCCE in debug mode (meaning that it will stop on any breakpoints that you place within `sscce.js` or any other Sequelize source code).

### 6. Commit your modifications

We squash all commits into a single one when we merge your PR.
That means you don't have to follow any convention in your commit messages,
but you will need to follow the [Conventional Commits Conventions](https://www.conventionalcommits.org/en/v1.0.0/) when writing the title of your PR.

We will then use the title of your PR as the message of the Squash Commit. It will then be used to automatically generate a changelog and calculate the next [semver](https://semver.org/) version number.

We use a simple conventional commits convention:
- The allowed commit types are: `docs`, `feat`, `fix`, `meta`.
- We allow the following commit scopes (they're the list of dialects we support, plus `types` for TypeScript-only changes):
  - `postgres`
  - `mysql`
  - `mariadb`
  - `sqlite`
  - `mssql`
  - `db2`
  - `ibmi`
  - `snowflake`
  - `types`
- If your changes impact more than one scope, simply omit the scope.

Example:

```
feat(postgres): support specifying a custom name for enums
```

Happy hacking and thank you for contributing.

# Coding guidelines

Have a look at our [.eslintrc.js](https://github.com/sequelize/sequelize/blob/main/.eslintrc.js) file for the specifics. As part of the test process, all files will be linted, and your PR will **not** be accepted if it does not pass linting.

# Contributing to the documentation

For contribution guidelines for the documentation, see [CONTRIBUTING.DOCS.md](https://github.com/sequelize/sequelize/blob/main/CONTRIBUTING.DOCS.md).
