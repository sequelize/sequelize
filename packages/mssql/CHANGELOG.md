# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [7.0.0-alpha.43](https://github.com/sequelize/sequelize/compare/v7.0.0-alpha.42...v7.0.0-alpha.43) (2024-10-04)

### Bug Fixes

- **mssql:** update mssql to v18.6.1 ([#17521](https://github.com/sequelize/sequelize/issues/17521)) ([b0ed3eb](https://github.com/sequelize/sequelize/commit/b0ed3eb5757af0b18c47c011ffc42b9c9cb44c46))
- unify returning queries ([#17157](https://github.com/sequelize/sequelize/issues/17157)) ([0a350c0](https://github.com/sequelize/sequelize/commit/0a350c0f91d0eee9c56b92f47cc23c273c9eb206))

# [7.0.0-alpha.42](https://github.com/sequelize/sequelize/compare/v7.0.0-alpha.41...v7.0.0-alpha.42) (2024-09-13)

### Bug Fixes

- **mssql:** add ability to use instanceName in connection-manager config ([#17432](https://github.com/sequelize/sequelize/issues/17432)) ([b2e0d69](https://github.com/sequelize/sequelize/commit/b2e0d69c3b4071c616f0e6ef8ceea8dfc3cbf284))

# [7.0.0-alpha.41](https://github.com/sequelize/sequelize/compare/v7.0.0-alpha.40...v7.0.0-alpha.41) (2024-05-17)

**Note:** Version bump only for package @sequelize/mssql

# [7.0.0-alpha.40](https://github.com/sequelize/sequelize/compare/v7.0.0-alpha.39...v7.0.0-alpha.40) (2024-04-11)

### Bug Fixes

- parse the `url` option based on the dialect ([#17252](https://github.com/sequelize/sequelize/issues/17252)) ([f05281c](https://github.com/sequelize/sequelize/commit/f05281cd406cba7d14c8770d64261ef6b859d143))

- feat(mssql)!: move mssql to the `@sequelize/mssql` package (#17206) ([8631f5a](https://github.com/sequelize/sequelize/commit/8631f5a51cf81e244f3160d753865bdfa0a2f539)), closes [#17206](https://github.com/sequelize/sequelize/issues/17206)

### Features

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
- Instead of installing the `mssql` package, users need to install `@sequelize/mssql`.
