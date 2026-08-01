_Please note!_ The github issue tracker should only be used for feature requests and bugs with a clear description of the issue and the expected behaviour (see below). All questions belong on [Slack](https://sequelize.slack.com), [StackOverflow](https://stackoverflow.com/questions/tagged/sequelize.js) or [Google groups](https://groups.google.com/forum/#!forum/sequelize).

# Issues
Issues are always very welcome - after all, they are a big part of making sequelize better. However, there are a couple of things you can do to make the lives of the developers _much, much_ easier:

### Tell us:

* What you are doing?
  * Post a _minimal_ code sample that reproduces the issue, including models and associations
  * What do you expect to happen?
  * What is actually happening?
* Which dialect you are using (postgres, mysql etc)?
* Which sequelize version you are using?

When you post code, please use [Github flavored markdown](https://help.github.com/articles/github-flavored-markdown), in order to get proper syntax highlighting!

If you can even provide a pull request with a failing unit test, we will love you long time! Plus your issue will likely be fixed much faster.

# Pull requests
We're glad to get pull request if any functionality is missing or something is buggy. However, there are a couple of things you can do to make life easier for the maintainers:

* Explain the issue that your PR is solving - or link to an existing issue
* Make sure that all existing tests pass
* Make sure you followed [coding guidelines](https://github.com/sequelize/sequelize/blob/master/CONTRIBUTING.md#coding-guidelines)
* Add some tests for your new functionality or a test exhibiting the bug you are solving. Ideally all new tests should not pass _without_ your changes.
  - Use [promise style](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises) in all new tests. Specifically this means:
    - don't use `EventEmitter`, `QueryChainer` or the `success`, `done` and `error` events
    - don't use nested callbacks (use arrow functions or variables to maintain context in promise chains)
    - don't use a done callback in your test, just return the promise chain.
  - Small bugfixes and direct backports to the 1.7 branch are accepted without tests.
* If you are adding to / changing the public API, remember to add API docs, in the form of [JSDoc style](http://usejsdoc.org/about-getting-started.html) comments. See [section 4a](#4a-check-the-documentation  ) for the specifics.
* Add an entry to the [changelog](https://github.com/sequelize/sequelize/blob/master/changelog.md), with a link to the issue you are solving

Still interested? Coolio! Here is how to get started:

### 1. Prepare your environment
Here comes a little surprise: You need [Node.JS](http://nodejs.org).

This repository uses [pnpm](https://pnpm.io), and pins both Node and pnpm with
[Volta](https://volta.sh):

```json
"volta": { "node": "24.18.1", "pnpm": "10.34.5" }
```

With Volta installed, `cd`-ing into the repo gives you the right Node and pnpm
automatically — nothing else to do. Without Volta, the same pnpm version is also in the
`packageManager` field, which `corepack enable` and pnpm itself both honour; you will
just have to get Node 24 yourself.

Keep `volta.pnpm` and `packageManager` in sync. pnpm self-switches to whatever
`packageManager` says, so if they disagree the `packageManager` value silently wins and
your Volta pin does nothing.

Node is pinned to 24 (current LTS) because that is the newest version CI tests. Newer
Node is not currently supported — Node 26 removed enough of the legacy `url.parse`
behaviour that `lib/sequelize.js` relies on to fail a unit test.

**pnpm is held at 10.x on purpose. Do not upgrade it to 11.** pnpm 11 requires Node
`>=22.13` and does not merely warn on older Node — it crashes with
`ERR_UNKNOWN_BUILTIN_MODULE`, so the Node 20 leg of the CI matrix would fail outright.
Node 20 support is a hard requirement (see `engines`), so pnpm stays on 10.x until that
floor moves. Everything 11 offers that we use, including the `minimumReleaseAge`
supply-chain gate, is already in pnpm 10.28+.

### 2. Install the dependencies

Just "cd" into sequelize directory and run `pnpm install`, see an example below:

```sh
$ cd path/to/sequelize
$ pnpm install
```

`pnpm-lock.yaml` is committed, so this gives you the same dependency tree CI uses.
If you change anything in `package.json`, commit the updated lockfile alongside it —
CI installs with `--frozen-lockfile` and will fail if the two disagree.

The `sqlite3` and `libpq` (via `pg-native`) packages compile native bindings. pnpm only
runs their build scripts because they are listed under `onlyBuiltDependencies` in
`pnpm-workspace.yaml`; if you add another dependency that needs a build step, it has to
be added there too or it will install silently broken.

### 3. Database

#### 3.a Local instances

For MySQL and PostgreSQL you'll need to create a DB called `sequelize_test`.
For MySQL this would look like this:

```sh
$ echo "CREATE DATABASE sequelize_test;" | mysql -uroot
```

**CLEVER NOTE:** by default, your local MySQL install must be with username `root` without password. If you want to customize that, you can set the environment variables `SEQ_DB`, `SEQ_USER`, `SEQ_PW`, `SEQ_HOST` and `SEQ_PORT`.

For Postgres, creating the database and (optionally) adding the test user this would look like:

```sh
$ psql

# create database sequelize_test;
# create user postgres with superuser;
```

#### 3.b Docker

Makes sure `docker` and `docker-compose` are installed.

If running on macOS, install [Docker for Mac](https://docs.docker.com/docker-for-mac/).

Now launch the docker mysql and postgres servers with this command (you can add `-d` to run them in daemon mode):

```sh
$ docker-compose up postgres-95 mysql-57
```

### 4. Running tests

All tests are located in the `test` folder (which contains the
lovely [Mocha](http://visionmedia.github.io/mocha/) tests).

```sh
$ pnpm run test-all || test-mysql || test-sqlite || test-mssql || test-postgres || test-postgres-native

$ # alternatively you can pass database credentials with $variables when testing
$ DIALECT=dialect SEQ_DB=database SEQ_USER=user SEQ_PW=password pnpm test
```

For docker users you can use these commands instead

```sh
$ DIALECT=mysql pnpm run test-docker # Or DIALECT=postgres for Postgres SQL

# Only integration tests
$ DIALECT=mysql pnpm run test-docker-integration
```

### 5. Commit

Sequelize follows the [AngularJS Commit Message Conventions](https://docs.google.com/document/d/1QrDFcIiPjSLDn3EL15IJygNPiHORgU1_OOAqWjiDU5Y/edit#heading=h.em2hiij8p46d).
Example:

    feat(pencil): add 'graphiteWidth' option

Commit messages are used to automatically generate a changelog, so make sure to follow the convention.
If you are unsure, you can let [commitizen](https://github.com/commitizen/cz-cli) ask you questions and commit for you (just run `node_modules/.bin/git-cz`).
When you commit, your commit message will be validated automatically with [validate-commit-msg](https://github.com/kentcdodds/validate-commit-msg).

Then push and send your pull request. Happy hacking and thank you for contributing.

# Coding guidelines

Have a look at our [.eslintrc.json](https://github.com/sequelize/sequelize/blob/master/.eslintrc.json) file for the specifics. As part of the test process, all files will be linted, and your PR will **not** be accepted if it does not pass linting.

# Publishing a release (For Maintainers)

This fork is **not published to a registry**. Consumers install it straight from a git
tag, so cutting a release means tagging — there is no `publish` step.

1. Ensure the latest build on `develop-v4` is green
2. Ensure your local code is up to date (`git pull origin develop-v4`)
3. `pnpm version patch|minor|major` (see [Semantic Versioning](http://semver.org)) — this
   bumps `package.json` and creates the `vX.Y.Z` tag
4. `git push origin develop-v4 --follow-tags`
5. Bump the pinned tag in the consumer, e.g. in `auditboard-backend`'s
   `pnpm-workspace.yaml` catalog: `"sequelize": "github:soxhub/sequelize#vX.Y.Z"`

**The tag is the only thing consumers see.** Commits pushed to `develop-v4` after the
most recent tag are not shipped, no matter how long they have been on the branch. If a
fix needs to go out, it needs a new tag and a matching bump on the consumer side.

## What gets shipped

The `files` array in `package.json` is the single source of truth for package contents:
`lib`, `index.js`, `index.d.ts`, plus `package.json`/`README.md`/`LICENSE`, which are
always included. There is deliberately no `.npmignore` — when `files` is present it
overrides `.npmignore` entirely, so having both meant one of them was dead config that
still looked authoritative.

If you add a new top-level file or directory that consumers need, add it to `files`.
Nothing else will include it. Verify with `pnpm pack` and inspect the tarball.

## Do not add a build step

This package ships raw `lib/` — there is deliberately no `prepare`, `prepack`, or
`build` script, and adding one is a breaking change for consumers. Because the package
is fetched as a GitHub tarball, a build script forces pnpm off that fast path into
clone-and-build, *and* trips pnpm's build gate: every consuming repo would have to add
`sequelize` to its own `onlyBuiltDependencies` before it would install at all.

If a build step ever becomes genuinely necessary, publish to a private registry instead.
