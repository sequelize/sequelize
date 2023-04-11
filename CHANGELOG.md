# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [7.0.0-alpha.26](https://github.com/sequelize/sequelize/compare/v7.0.0-alpha.25...v7.0.0-alpha.26) (2023-04-11)


### Bug Fixes

* deprecate setting quoteIdentifiers to false ([#15879](https://github.com/sequelize/sequelize/issues/15879)) ([54e0db4](https://github.com/sequelize/sequelize/commit/54e0db43cde27b1de2ad8a9b81770a6a15dc5e99))
* **ibmi:** correct check for connected connection ([#15852](https://github.com/sequelize/sequelize/issues/15852)) ([64aa16e](https://github.com/sequelize/sequelize/commit/64aa16ed44688f02539f008f5140ec7f1cced689))
* **mariadb:** do not automatically parse JSON fields by checking meta ([#15704](https://github.com/sequelize/sequelize/issues/15704)) ([0c0a4d4](https://github.com/sequelize/sequelize/commit/0c0a4d44f9c2152df88f7a932ff10c7523d3c060))
* **mysql:** don't print milliseconds if date precision is 0 ([#15838](https://github.com/sequelize/sequelize/issues/15838)) ([551e7ef](https://github.com/sequelize/sequelize/commit/551e7ef302135ffd4d33f4182ee89dfb22132046))
* remove undefined options in sequelize.define ([#15817](https://github.com/sequelize/sequelize/issues/15817)) ([6b61ddf](https://github.com/sequelize/sequelize/commit/6b61ddfce4803694eb83a4c80bb0ec8f072a412a))
* restrict precision option in DATE and TIME to number ([#15800](https://github.com/sequelize/sequelize/issues/15800)) ([7bd5907](https://github.com/sequelize/sequelize/commit/7bd5907a471f74d7467f9aa7c112a4976ce8e328))
* **sqlite:** don't use mkdirp if the file already exists ([#15909](https://github.com/sequelize/sequelize/issues/15909)) ([f5bbd6b](https://github.com/sequelize/sequelize/commit/f5bbd6b393ca93670c055709754871f15d52092a))
* type createTableQuery and overhaul unit test suite ([#15526](https://github.com/sequelize/sequelize/issues/15526)) ([b5db02d](https://github.com/sequelize/sequelize/commit/b5db02d72ccd925e41e7a7a3b8f8ea5951dc4dd4))
* type QueryGenerator.dropForeignKeyQuery and add tests ([#15807](https://github.com/sequelize/sequelize/issues/15807)) ([0435174](https://github.com/sequelize/sequelize/commit/043517414a9d2608745cf4f2505010defd3d7f98))
* type renameTableQuery, removeConstraintQuery, versionQuery ([#15813](https://github.com/sequelize/sequelize/issues/15813)) ([8928c6d](https://github.com/sequelize/sequelize/commit/8928c6d939e32fb7923c4f1e5ffbe677ad93fab4))


### Features

* add `queryInterface.withoutForeignKeyChecks`, `sequelize.destroyAll` ([#15842](https://github.com/sequelize/sequelize/issues/15842)) ([3cfe672](https://github.com/sequelize/sequelize/commit/3cfe6722cee3dc81ba5582dfddbddae5f9bc9c53))
* add `sequelize.withConnection`, rename `sequelize.set` to `sequelize.setSessionVariables` ([#15851](https://github.com/sequelize/sequelize/issues/15851)) ([336d712](https://github.com/sequelize/sequelize/commit/336d712d2cc7c78a490df7d0a56a1114de1fd4c4))
* add `Transaction#afterRollback`, `Transaction#afterTransaction` ([#15837](https://github.com/sequelize/sequelize/issues/15837)) ([4bca19a](https://github.com/sequelize/sequelize/commit/4bca19a25558b9926653c54aa892c7ac478ce775))
* add beforePoolAcquire and afterPoolAcquire hooks. ([#15859](https://github.com/sequelize/sequelize/issues/15859)) ([6711351](https://github.com/sequelize/sequelize/commit/67113511e67dd709bea99527be3bde41a6b823cf))
* move pg-hstore to prod dependencies ([#15914](https://github.com/sequelize/sequelize/issues/15914)) ([aebb9ed](https://github.com/sequelize/sequelize/commit/aebb9ed1a1dd166bbc4730faf15cb3ba6752a5c9))
* **postgres:** support connectionTimeoutMillis dialectOption ([#15841](https://github.com/sequelize/sequelize/issues/15841)) ([8a98dde](https://github.com/sequelize/sequelize/commit/8a98dde54995a482c8e3814d51803783bb3117fd))
* support SRID in mysql/mariadb ([#15835](https://github.com/sequelize/sequelize/issues/15835)) ([d326d84](https://github.com/sequelize/sequelize/commit/d326d84d96e5e9f687e86c5b7cbf4c507e9c5d0c))





# [7.0.0-alpha.25](https://github.com/sequelize/sequelize/compare/v7.0.0-alpha.24...v7.0.0-alpha.25) (2023-03-15)


### Bug Fixes

* **mssql:** make inner enqueue function async ([#15785](https://github.com/sequelize/sequelize/issues/15785)) ([e6690cd](https://github.com/sequelize/sequelize/commit/e6690cdf27980d57be1bb9f138b04124775b153b))
* pin bnf-parser ([#15793](https://github.com/sequelize/sequelize/issues/15793)) ([9a9a404](https://github.com/sequelize/sequelize/commit/9a9a404fcd155079af9208626aa67df4ad335879))


### Features

* add timestamp & version attributes ([#15767](https://github.com/sequelize/sequelize/issues/15767)) ([9795fcf](https://github.com/sequelize/sequelize/commit/9795fcf82e5c66d1f5be28852778b6886942fe7f))





# [7.0.0-alpha.24](https://github.com/sequelize/sequelize/compare/v7.0.0-alpha.23...v7.0.0-alpha.24) (2023-03-12)


### Bug Fixes

* fix unnamed dollar string detection (v7) ([#15758](https://github.com/sequelize/sequelize/issues/15758)) ([b2fe30f](https://github.com/sequelize/sequelize/commit/b2fe30f8ed076c02b60beb0d88affa832e6d896b))
* fix various type issues ([#15765](https://github.com/sequelize/sequelize/issues/15765)) ([26beda5](https://github.com/sequelize/sequelize/commit/26beda5bf76bd65e30264ebf135e39efaa7d514d))
* **postgres:** sync with alter method fails with dataType enum ([#15738](https://github.com/sequelize/sequelize/issues/15738)) ([6d9a58e](https://github.com/sequelize/sequelize/commit/6d9a58e7556de614133c2d16ba6ee8e8cebd5fa0)), closes [#7649](https://github.com/sequelize/sequelize/issues/7649)
* prevent BelongsTo's inverse association from itself creating a BelongsTo ([#15756](https://github.com/sequelize/sequelize/issues/15756)) ([27312bd](https://github.com/sequelize/sequelize/commit/27312bdc849c25c60cb88a677c2854e57c79b94e))


### Features

* remove escape options from data types ([#15766](https://github.com/sequelize/sequelize/issues/15766)) ([5c42821](https://github.com/sequelize/sequelize/commit/5c428218df05a6354cc039d73eb58a49434172ee))
* rewrite the part of QueryGenerator responsible for WHERE ([#15598](https://github.com/sequelize/sequelize/issues/15598)) ([50898ca](https://github.com/sequelize/sequelize/commit/50898cac7c979edd94cd7eb68242d9aff7362378))





# [7.0.0-alpha.23](https://github.com/sequelize/sequelize/compare/v7.0.0-alpha.22...v7.0.0-alpha.23) (2023-03-10)


### Features

* test change for test release, please ignore ([2d191c1](https://github.com/sequelize/sequelize/commit/2d191c19d5dd06b4ca8a58f2c268abf9db0b50d3))





# 7.0.0-alpha.22 (2023-03-04)

**Note:** Version bump only for package @sequelize/monorepo





# 7.0.0-alpha.21 (2023-01-19)

**Note:** Version bump only for package @sequelize/monorepo
