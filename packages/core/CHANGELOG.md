# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [7.0.0-alpha.40](https://github.com/sequelize/sequelize/compare/v7.0.0-alpha.39...v7.0.0-alpha.40) (2024-04-11)

### Bug Fixes

- parse the `url` option based on the dialect ([#17252](https://github.com/sequelize/sequelize/issues/17252)) ([f05281c](https://github.com/sequelize/sequelize/commit/f05281cd406cba7d14c8770d64261ef6b859d143))
- update bulkDeleteQuery supported options ([#17191](https://github.com/sequelize/sequelize/issues/17191)) ([c53fd01](https://github.com/sequelize/sequelize/commit/c53fd0114ab7a796d7b649abd12086e3c6f7d077))

- feat(mssql)!: move mssql to the `@sequelize/mssql` package (#17206) ([8631f5a](https://github.com/sequelize/sequelize/commit/8631f5a51cf81e244f3160d753865bdfa0a2f539)), closes [#17206](https://github.com/sequelize/sequelize/issues/17206)
- feat(ibmi)!: move ibmi to the `@sequelize/ibmi` package (#17209) ([21772a5](https://github.com/sequelize/sequelize/commit/21772a5b2aa4eec952f91ba747093cb737af4af9)), closes [#17209](https://github.com/sequelize/sequelize/issues/17209)
- feat(mysql)!: move mysql to the `@sequelize/mysql` package (#17202) ([5c7830e](https://github.com/sequelize/sequelize/commit/5c7830e976900cca2b8c40535a0e895a66f2d8a6)), closes [#17202](https://github.com/sequelize/sequelize/issues/17202)
- feat(mariadb)!: move mariadb to the `@sequelize/mariadb` package (#17198) ([46ea159](https://github.com/sequelize/sequelize/commit/46ea159306c55c7b3c02ac0ba24a2c0dd3dff4d9)), closes [#17198](https://github.com/sequelize/sequelize/issues/17198)

### Features

- add `ModelRepository#_UNSTABLE_bulkDestroy` and manual `ON DELETE` handling ([#17078](https://github.com/sequelize/sequelize/issues/17078)) ([45ac01a](https://github.com/sequelize/sequelize/commit/45ac01acbb56d815ad195649003501407e31f8b4))
- **db2:** move db2 to the `@sequelize/db2` package ([#17197](https://github.com/sequelize/sequelize/issues/17197)) ([6aa4ced](https://github.com/sequelize/sequelize/commit/6aa4ceda95fb5fb96abaf6e0de3cd116ade664f9))
- move postgres to the `@sequelize/postgres` package ([#17190](https://github.com/sequelize/sequelize/issues/17190)) ([721d560](https://github.com/sequelize/sequelize/commit/721d56061c801015a8ec91d8e0aed30b5da24497))
- **mssql:** upgrade to tedious 18 ([#17137](https://github.com/sequelize/sequelize/issues/17137)) ([65e19a1](https://github.com/sequelize/sequelize/commit/65e19a174f69aaef12f396e062a8270362b48a50))
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
- Instead of installing the `odbc` package, users need to install `@sequelize/ibmi`.
- Instead of installing `mysql2`, users need to install `@sequelize/mysql`.
- Instead of installing the `mariadb` package, users need to install `@sequelize/mariadb.`
