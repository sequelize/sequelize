# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [7.0.0-alpha.44](https://github.com/sequelize/sequelize/compare/v7.0.0-alpha.43...v7.0.0-alpha.44) (2025-01-27)

### Bug Fixes

- **core:** adjust Model.sum|min|max return type to include null ([#17527](https://github.com/sequelize/sequelize/issues/17527)) ([5135e83](https://github.com/sequelize/sequelize/commit/5135e8305789d438f636e366c453db04f6560db5))
- **core:** Improve type declaration for model validation functions ([#17586](https://github.com/sequelize/sequelize/issues/17586)) ([78fd0ea](https://github.com/sequelize/sequelize/commit/78fd0ea8dbf46748815d90b24d698908f5169ffd))
- remove deprecated tasksRunnerOptions ([#17652](https://github.com/sequelize/sequelize/issues/17652)) ([b0c7778](https://github.com/sequelize/sequelize/commit/b0c77782c5208b8dc7dd86b4a29a5f30489639dd))
- **snowflake:** automatically fetch last inserted row ID when using AUTOINCREMENT pk ([#17626](https://github.com/sequelize/sequelize/issues/17626)) ([d2e3b6e](https://github.com/sequelize/sequelize/commit/d2e3b6e44f9ed3d85c67f07e76e02c59dc76177a))
- update broken link to lock docs ([#17563](https://github.com/sequelize/sequelize/issues/17563)) ([3754bda](https://github.com/sequelize/sequelize/commit/3754bda7f54822d7da8c7c4cfb742d0d6924e97a))
- update inquirer ([#17540](https://github.com/sequelize/sequelize/issues/17540)) ([e34acec](https://github.com/sequelize/sequelize/commit/e34acec96e7eed54300fad1aa6c2a543bf76ac91))
- update prettier to v3.3.3 ([#17534](https://github.com/sequelize/sequelize/issues/17534)) ([7d2e72e](https://github.com/sequelize/sequelize/commit/7d2e72e84da08075a631fc43bf69d909649fc297))

### Features

- replace correlated subquery with EXISTS ([#17354](https://github.com/sequelize/sequelize/issues/17354)) ([4491353](https://github.com/sequelize/sequelize/commit/4491353eaf50067589a7958b28af7572d1c411ff))

# [7.0.0-alpha.43](https://github.com/sequelize/sequelize/compare/v7.0.0-alpha.42...v7.0.0-alpha.43) (2024-10-04)

### Bug Fixes

- **db2:** remove unnecessary override ([#17525](https://github.com/sequelize/sequelize/issues/17525)) ([9a51a05](https://github.com/sequelize/sequelize/commit/9a51a05569cf7b3ff9e532611f1bce07839d7ce2))
- **mariadb:** fix inefficient regular expression in error message ([#17508](https://github.com/sequelize/sequelize/issues/17508)) ([3f5250b](https://github.com/sequelize/sequelize/commit/3f5250b9741c265031e5e7307c2fe3e9cef56b48))
- **mariadb:** update mariadb to v3.3.2 ([#17518](https://github.com/sequelize/sequelize/issues/17518)) ([3819cf5](https://github.com/sequelize/sequelize/commit/3819cf545f2a20a7db28dda649bb4881dd015b16))
- **mssql:** update mssql to v18.6.1 ([#17521](https://github.com/sequelize/sequelize/issues/17521)) ([b0ed3eb](https://github.com/sequelize/sequelize/commit/b0ed3eb5757af0b18c47c011ffc42b9c9cb44c46))
- **mysql:** update mysql2 to ^3.11.2 ([#17498](https://github.com/sequelize/sequelize/issues/17498)) ([18ce1b0](https://github.com/sequelize/sequelize/commit/18ce1b0c5c0f237c17f91647217d769cb194da78))
- **snowflake:** update snowflake to v1.14.0 ([#17526](https://github.com/sequelize/sequelize/issues/17526)) ([41ae5c3](https://github.com/sequelize/sequelize/commit/41ae5c3c8dbf42d15c351fda428a7cb5e59e151c))
- unify returning queries ([#17157](https://github.com/sequelize/sequelize/issues/17157)) ([0a350c0](https://github.com/sequelize/sequelize/commit/0a350c0f91d0eee9c56b92f47cc23c273c9eb206))

### Features

- respect position of inherited attributes ([#17517](https://github.com/sequelize/sequelize/issues/17517)) ([691d90b](https://github.com/sequelize/sequelize/commit/691d90ba8c695c389c34f61fba3ff7fcaf52d634))

# [7.0.0-alpha.42](https://github.com/sequelize/sequelize/compare/v7.0.0-alpha.41...v7.0.0-alpha.42) (2024-09-13)

### Bug Fixes

- **mssql:** add ability to use instanceName in connection-manager config ([#17432](https://github.com/sequelize/sequelize/issues/17432)) ([b2e0d69](https://github.com/sequelize/sequelize/commit/b2e0d69c3b4071c616f0e6ef8ceea8dfc3cbf284))

# [7.0.0-alpha.41](https://github.com/sequelize/sequelize/compare/v7.0.0-alpha.40...v7.0.0-alpha.41) (2024-05-17)

### Bug Fixes

- make `BaseSqlExpression` a unique class ([#17158](https://github.com/sequelize/sequelize/issues/17158)) ([6a5ea6c](https://github.com/sequelize/sequelize/commit/6a5ea6c774b1812a40dd26e873b56291f868bf3f))
- set sequelize dialect type in query generator and interface ([#17285](https://github.com/sequelize/sequelize/issues/17285)) ([0227288](https://github.com/sequelize/sequelize/commit/0227288d1c6fcbf2d4f09e2efa50e4aeb9d435f2))
- **snowflake:** add proxy connection options ([#17309](https://github.com/sequelize/sequelize/issues/17309)) ([51b781e](https://github.com/sequelize/sequelize/commit/51b781e4028f4eda5c4221d94cf4c9141055a762))
