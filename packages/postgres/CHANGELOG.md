# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [7.0.0-alpha.47](https://github.com/sequelize/sequelize/compare/v7.0.0-alpha.46...v7.0.0-alpha.47) (2025-10-25)

### Bug Fixes

- **postgres:** order on column name in showConstraintsQuery ([#17760](https://github.com/sequelize/sequelize/issues/17760)) ([5de096a](https://github.com/sequelize/sequelize/commit/5de096aefe86ca8941667ecadd5a91059312a5d9))

# [7.0.0-alpha.46](https://github.com/sequelize/sequelize/compare/v7.0.0-alpha.45...v7.0.0-alpha.46) (2025-03-22)

### Bug Fixes

- **postgres:** correct existing enum type matching ([#17576](https://github.com/sequelize/sequelize/issues/17576)) ([425d217](https://github.com/sequelize/sequelize/commit/425d21718af40f86015f6496ea6cf721cc61b981))
- **postgres:** update to postgres 17 ([#17740](https://github.com/sequelize/sequelize/issues/17740)) ([b5c2b26](https://github.com/sequelize/sequelize/commit/b5c2b2667004b3b27e5634c677507f5593987938))

# [7.0.0-alpha.45](https://github.com/sequelize/sequelize/compare/v7.0.0-alpha.44...v7.0.0-alpha.45) (2025-02-17)

**Note:** Version bump only for package @sequelize/postgres

# [7.0.0-alpha.44](https://github.com/sequelize/sequelize/compare/v7.0.0-alpha.43...v7.0.0-alpha.44) (2025-01-27)

**Note:** Version bump only for package @sequelize/postgres

# [7.0.0-alpha.43](https://github.com/sequelize/sequelize/compare/v7.0.0-alpha.42...v7.0.0-alpha.43) (2024-10-04)

### Bug Fixes

- unify returning queries ([#17157](https://github.com/sequelize/sequelize/issues/17157)) ([0a350c0](https://github.com/sequelize/sequelize/commit/0a350c0f91d0eee9c56b92f47cc23c273c9eb206))

# [7.0.0-alpha.42](https://github.com/sequelize/sequelize/compare/v7.0.0-alpha.41...v7.0.0-alpha.42) (2024-09-13)

**Note:** Version bump only for package @sequelize/postgres

# [7.0.0-alpha.41](https://github.com/sequelize/sequelize/compare/v7.0.0-alpha.40...v7.0.0-alpha.41) (2024-05-17)

**Note:** Version bump only for package @sequelize/postgres

# [7.0.0-alpha.40](https://github.com/sequelize/sequelize/compare/v7.0.0-alpha.39...v7.0.0-alpha.40) (2024-04-11)

### Bug Fixes

- parse the `url` option based on the dialect ([#17252](https://github.com/sequelize/sequelize/issues/17252)) ([f05281c](https://github.com/sequelize/sequelize/commit/f05281cd406cba7d14c8770d64261ef6b859d143))
- update bulkDeleteQuery supported options ([#17191](https://github.com/sequelize/sequelize/issues/17191)) ([c53fd01](https://github.com/sequelize/sequelize/commit/c53fd0114ab7a796d7b649abd12086e3c6f7d077))

- feat(mariadb)!: move mariadb to the `@sequelize/mariadb` package (#17198) ([46ea159](https://github.com/sequelize/sequelize/commit/46ea159306c55c7b3c02ac0ba24a2c0dd3dff4d9)), closes [#17198](https://github.com/sequelize/sequelize/issues/17198)

### Features

- move postgres to the `@sequelize/postgres` package ([#17190](https://github.com/sequelize/sequelize/issues/17190)) ([721d560](https://github.com/sequelize/sequelize/commit/721d56061c801015a8ec91d8e0aed30b5da24497))
- re-add the ability to override the connector library ([#17219](https://github.com/sequelize/sequelize/issues/17219)) ([b3c3362](https://github.com/sequelize/sequelize/commit/b3c3362aeca7ce50d0bdb657c6db25f2418dc687))
- rename `@sequelize/sqlite` to `@sequelize/sqlite3`, `@sequelize/ibmi` to `@sequelize/db2-ibmi`, ban conflicting options ([#17269](https://github.com/sequelize/sequelize/issues/17269)) ([1fb48a4](https://github.com/sequelize/sequelize/commit/1fb48a462c96ec64bf8ed19f91662c4d73e1fe3e))
- type options per dialect, add "url" option, remove alternative Sequelize constructor signatures ([#17222](https://github.com/sequelize/sequelize/issues/17222)) ([b605bb3](https://github.com/sequelize/sequelize/commit/b605bb372b1500a75daa46bb4c4ae6f4912094a1))

### BREAKING CHANGES

- `db2`, `ibmi`, `snowflake` and `sqlite` do not accept the `url` option anymore
- The sequelize constructor only accepts a single parameter: the option bag. All other signatures have been removed.
- Setting the sequelize option to a string representing a URL has been replaced with the `"url"` option.
- The `dialectOptions` option has been removed. All options that were previously in that object can now be set at the root of the option bag, like all other options.
- All dialect-specific options changed. This includes at least some credential options that changed.
- Which dialect-specific option can be used is allow-listed to ensure they do not break Sequelize
- The sequelize pool is not on the connection manager anymore. It is now directly on the sequelize instance and can be accessed via `sequelize.pool`
- The `sequelize.config` field has been removed. Everything related to connecting to the database has been normalized to `sequelize.options.replication.write` (always present) and `sequelize.options.replication.read` (only present if read-replication is enabled)
- `sequelize.options` is now fully frozen. It is no longer possible to modify the Sequelize options after the instance has been created.
- `sequelize.options` is a normalized list of option. If you wish to access the options that were used to create the sequelize instance, use `sequelize.rawOptions`
- The default sqlite database is not `':memory:'` anymore, but `sequelize.sqlite` in your current working directory.
- Setting the sqlite database to a temporary database like `':memory:'` or `''` requires configuring the pool to behave like a singleton, and disallowed read replication
- The `match` option is no longer supported by `sequelize.sync`. If you made use of this feature, let us know so we can design a better alternative.
- The `dialectModulePath` has been fully removed to improve compatibility with bundlers.
- The `dialectModule` option has been split into multiple options. Each option is named after the npm library that is being replaced. For instance, `@sequelize/postgres` now accepts `pgModule`. `@sequelize/mssql` now accepts `tediousModule`
- Instead of installing the `mariadb` package, users need to install `@sequelize/mariadb.`
