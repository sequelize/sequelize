# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [7.0.0-alpha.28](https://github.com/sequelize/sequelize/compare/v7.0.0-alpha.27...v7.0.0-alpha.28) (2023-09-11)


### Bug Fixes

* allow bind parameters in array literal ([#16328](https://github.com/sequelize/sequelize/issues/16328)) ([4d624fd](https://github.com/sequelize/sequelize/commit/4d624fd37e84a0b9215bac0b0a1ab85892a81cef))
* build on windows machines ([#16211](https://github.com/sequelize/sequelize/issues/16211)) ([808adeb](https://github.com/sequelize/sequelize/commit/808adebebdaadb81644fd927a3bb146ce472e142))
* **db2:** use docker compose & set default schema as username ([#16307](https://github.com/sequelize/sequelize/issues/16307)) ([c59011c](https://github.com/sequelize/sequelize/commit/c59011cad93e8fe3ae80c9139de98a541ba9e5c6))
* **mssql:** return aggregated error instead of last error ([#16188](https://github.com/sequelize/sequelize/issues/16188)) ([dea29f7](https://github.com/sequelize/sequelize/commit/dea29f79e180ac1ec7c0392175c3f38ac156f40a))
* outaded link on unsupported engines warning ([#16435](https://github.com/sequelize/sequelize/issues/16435)) ([b376ac2](https://github.com/sequelize/sequelize/commit/b376ac22defb9aec7a969c96f22ae01686fc12ae))
* rename `clsTransactionNestMode` ➡️ `defaultTransactionNestMode`; `ClsTransactionOptions` ➡️ `ManagedTransactionOptions` ([#16174](https://github.com/sequelize/sequelize/issues/16174)) ([8637a46](https://github.com/sequelize/sequelize/commit/8637a4609505de6cecdfd91999c43ae71e7b065d))
* support array of tableHints and allow joins to use tableHints ([#16242](https://github.com/sequelize/sequelize/issues/16242)) ([c081850](https://github.com/sequelize/sequelize/commit/c081850f6c87728ff25645529c19342419a127fa))
* **types:** allow Op.contains on a jsonb column ([#16167](https://github.com/sequelize/sequelize/issues/16167)) ([70c2bf5](https://github.com/sequelize/sequelize/commit/70c2bf505a6aa88a43ec46383cbb094f88939385))


### Features

* add constraint filters ([#16199](https://github.com/sequelize/sequelize/issues/16199)) ([a734bab](https://github.com/sequelize/sequelize/commit/a734babe0bf989389a4775597b3615404dce9d6c))
* **mariadb:** split MariaDB from MySQL ([#16200](https://github.com/sequelize/sequelize/issues/16200)) ([7022c48](https://github.com/sequelize/sequelize/commit/7022c48214901aadceca87709835ee1f5bb36bfc))
* migrate constraints to typescript ([#15962](https://github.com/sequelize/sequelize/issues/15962)) ([0e17c07](https://github.com/sequelize/sequelize/commit/0e17c07b93e139aafbab470f88847affceec23a7))
* migrate table queries to typescript ([#16452](https://github.com/sequelize/sequelize/issues/16452)) ([c67db53](https://github.com/sequelize/sequelize/commit/c67db5333eff930032ae03a52744600a9fd1b782))
* migrate tableExists to typescript ([#16320](https://github.com/sequelize/sequelize/issues/16320)) ([5167e88](https://github.com/sequelize/sequelize/commit/5167e880abe9bb6f5338815149a838e7f23a1b59))
* migrate version queries to typescript ([#16153](https://github.com/sequelize/sequelize/issues/16153)) ([37dbf08](https://github.com/sequelize/sequelize/commit/37dbf081b7514064b53a9b16ae93987e2c5d0264))
* **sqlite:** split SQLite from MySQL ([#16201](https://github.com/sequelize/sequelize/issues/16201)) ([789b690](https://github.com/sequelize/sequelize/commit/789b6900e5682792382d860a190249c16e4e3931))
* **types:** migrate model-manager to TypeScript ([#16070](https://github.com/sequelize/sequelize/issues/16070)) ([605150e](https://github.com/sequelize/sequelize/commit/605150e2379f8b141f7b3353c44ac12d348d0883))
* **types:** restrict attributes typing ([#15607](https://github.com/sequelize/sequelize/issues/15607)) ([0012466](https://github.com/sequelize/sequelize/commit/0012466cc44c364d77b7fa8fd0e251a642375370))
* unify constraint queries ([#16187](https://github.com/sequelize/sequelize/issues/16187)) ([62a59b0](https://github.com/sequelize/sequelize/commit/62a59b016b77e37c6ffee5b15eaaedde79992fb9))





# [7.0.0-alpha.27](https://github.com/sequelize/sequelize/compare/v7.0.0-alpha.26...v7.0.0-alpha.27) (2023-06-21)


### Bug Fixes

* Bulk Update failure when virtual attributes and getDataValue are involved ([#15741](https://github.com/sequelize/sequelize/issues/15741)) ([f5a8815](https://github.com/sequelize/sequelize/commit/f5a8815bf10d3976438d69bf58159db24bfd5ae9))
* merge getForeignKeysQuery with getForeignKeyQuery, unify unit tests and migrate to TS ([#15454](https://github.com/sequelize/sequelize/issues/15454)) ([e940f42](https://github.com/sequelize/sequelize/commit/e940f429efc8ca1e63bd91a21e31858a09f02151))
* **postgres:** prevent crash if postgres connection emits multiple errors ([#15867](https://github.com/sequelize/sequelize/issues/15867)) ([42fbcc4](https://github.com/sequelize/sequelize/commit/42fbcc467aad03e0c588909d81f75dc263abe240))
* remove add/removeTicks ([#15973](https://github.com/sequelize/sequelize/issues/15973)) ([ef00e92](https://github.com/sequelize/sequelize/commit/ef00e92416d11a925cbf4f1ab06373072688626e))
* **types:** fix generic type of `Model#changed` ([#16047](https://github.com/sequelize/sequelize/issues/16047)) ([fad20ee](https://github.com/sequelize/sequelize/commit/fad20eeee600955cb7782acaef0994804de5e532))
* use singular association name to generate FK ([#16142](https://github.com/sequelize/sequelize/issues/16142)) ([8f8f13e](https://github.com/sequelize/sequelize/commit/8f8f13e45ce9ab4f07657c0dceb06745c62de103))


### Features

* add `nestMode` option for managed transactions ([#16143](https://github.com/sequelize/sequelize/issues/16143)) ([c4eef63](https://github.com/sequelize/sequelize/commit/c4eef638edbc807167d65ef7559622497e332348))
* add included columns in index definition  ([#15405](https://github.com/sequelize/sequelize/issues/15405)) ([5c1c7ff](https://github.com/sequelize/sequelize/commit/5c1c7ff6b9482df4214d6c88f1c4ba4255e22af1))
* add support for model inheritance ([#16095](https://github.com/sequelize/sequelize/issues/16095)) ([6c553a9](https://github.com/sequelize/sequelize/commit/6c553a9cd4fc4d76a1b3cf217c55de626a29288b))
* drop support for Node 14 and add for Node 20 ([#16058](https://github.com/sequelize/sequelize/issues/16058)) ([39bf550](https://github.com/sequelize/sequelize/commit/39bf550a9f6cb4105ae6e406970557edccd2e421))
* make `set` association method delete old associated entity for non-null FKs  ([#15840](https://github.com/sequelize/sequelize/issues/15840)) ([67d66f1](https://github.com/sequelize/sequelize/commit/67d66f1fa35ff5028bcb35aed13c3307f464d874))
* **mariadb:** drop 10.3 and add 11.0 support ([#16133](https://github.com/sequelize/sequelize/issues/16133)) ([64e392d](https://github.com/sequelize/sequelize/commit/64e392d083ddb7f0415cc70fda1db3ab72c3a7d8))
* migrate describeTable to typescript ([#15945](https://github.com/sequelize/sequelize/issues/15945)) ([37bff7e](https://github.com/sequelize/sequelize/commit/37bff7e2948d80fe8e5133452d2f5ba7559441cb))
* **mssql:** add json operations support ([#15832](https://github.com/sequelize/sequelize/issues/15832)) ([b0ee419](https://github.com/sequelize/sequelize/commit/b0ee4198788858a0c7ddee492fa65e64787dab51))
* **mysql:** support max_execution_time optimizer hint ([#15341](https://github.com/sequelize/sequelize/issues/15341)) ([fc3d6aa](https://github.com/sequelize/sequelize/commit/fc3d6aaa1e1d5a8577bbe046b40472894529bd73))
* **postgres:** add stream to connectionConfig ([#16056](https://github.com/sequelize/sequelize/issues/16056)) ([abeacd5](https://github.com/sequelize/sequelize/commit/abeacd5ea2e32f6e6fbf91b6a0c94d9139fafb67))
* reject invalid options for createTableQuery ([#15846](https://github.com/sequelize/sequelize/issues/15846)) ([2dcd69a](https://github.com/sequelize/sequelize/commit/2dcd69a3bb40736e23659ea99fed7f5dab29d1fb))
* support TS 5.1, drop TS 4.7 ([#16089](https://github.com/sequelize/sequelize/issues/16089)) ([0f2706d](https://github.com/sequelize/sequelize/commit/0f2706d756786d5b754a2c5a70fed0d512c95b8f))
* update mariadb connector to v3 ([#16139](https://github.com/sequelize/sequelize/issues/16139)) ([bc26271](https://github.com/sequelize/sequelize/commit/bc26271f090c7770b434422684a07f0f69fb9616))


### BREAKING CHANGES

* Sequelize now requires Node >=16.0.0
* **mariadb:** If using MariaDB, Sequelize requires MariaDB 10.4.30 or higher
* minimum mariadb npm package version is now 3.1.2





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

**Note:** Version bump only for package @sequelize/core





# 7.0.0-alpha.21 (2023-01-19)

**Note:** Version bump only for package @sequelize/core
