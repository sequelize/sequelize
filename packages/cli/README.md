<p align="center"><img src="https://raw.githubusercontent.com/sequelize/sequelize/ec80c6252ac500df9342816b7f49957f3974e882/logo.svg" width="100" alt="Sequelize logo" /></p>
<h1 align="center" style="margin-top: 0;"><a href="https://sequelize.org">Sequelize</a></h1>

## Installation

Using npm:

```sh
npm install @sequelize/cli
```

Or using yarn:

```sh
yarn add @sequelize/cli
```

## Usage

- If installed globally: `sequelize --help`
- If installed locally using `yarn`: `yarn sequelize --help`
- If installed locally using `npm`: `npx sequelize --help`

## Configuration

The CLI uses [cosmiconfig](https://github.com/cosmiconfig/cosmiconfig) to find its configuration.
It searches the current working directory (it does not walk up to parent directories) and uses the
first of these that exists and is non-empty:

1. `package.json` — the `sequelize` property
2. `.sequelizerc` (parsed as YAML)
3. `.sequelizerc.json`
4. `.sequelizerc.yaml`
5. `.sequelizerc.yml`
6. `.sequelizerc.js`
7. `.sequelizerc.ts`
8. `.sequelizerc.cjs`
9. `.sequelizerc.mjs`
10. the same eight `sequelizerc` variants (2–9) again, inside a `.config` directory
11. `sequelize.config.js`
12. `sequelize.config.ts`
13. `sequelize.config.cjs`
14. `sequelize.config.mjs`

The first match wins; the remaining locations are not read. The directory containing the config file
is treated as the project root, and relative `migrationFolder` / `seedFolder` values are resolved
against it.

A JavaScript config file exports its configuration as the default export:

```js
// sequelize.config.mjs
import { PostgresDialect } from '@sequelize/postgres';

export default {
  migrationFolder: '/migrations',
  seedFolder: '/seeds',
  database: {
    dialect: PostgresDialect,
    url: process.env.DATABASE_URL,
  },
};
```

### Config files are executed as code

The `.js`, `.cjs`, `.mjs` and `.ts` entries above are modules: the CLI imports them, which runs
whatever they contain, before the command you asked for does any work. This is deliberate — it is
what lets a config read environment variables, import a dialect class, or compute paths, as in the
example above.

It does mean a project's CLI config carries the same trust as the project's source code. Running any
`sequelize` command in a directory runs that directory's config file. Picking an inert format such
as `.sequelizerc.json` for your own project does not opt out of this: whichever file is discovered
first is the one that is used, and if it is a JavaScript or TypeScript module, it executes.

This is worth keeping in mind in CI. A job that checks out a branch and runs a `sequelize` command
executes that branch's config file, so treat it the way you already treat running that branch's
build scripts or tests.

## Documentation

The documentation can be found at https://sequelize.org/docs/v7/cli/
