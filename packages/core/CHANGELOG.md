# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [7.0.0-alpha.47](https://github.com/sequelize/sequelize/compare/v7.0.0-alpha.46...v7.0.0-alpha.47) (2025-10-25)

### Bug Fixes

- **core:** correct subquery join resolution & use alias minification for join references ([#18012](https://github.com/sequelize/sequelize/issues/18012)) ([af74df1](https://github.com/sequelize/sequelize/commit/af74df1f915d84f01dfcbdd5b467d7d7bdd68f66))
- **postgres, sqlite3:** map conflictFields to column names in Model.upsert ([#17211](https://github.com/sequelize/sequelize/issues/17211)) ([ba9e86f](https://github.com/sequelize/sequelize/commit/ba9e86f271f765ac0b476fca930b40a5250678f6))
- **postgres:** order on column name in showConstraintsQuery ([#17760](https://github.com/sequelize/sequelize/issues/17760)) ([5de096a](https://github.com/sequelize/sequelize/commit/5de096aefe86ca8941667ecadd5a91059312a5d9))

### Features

- add parameter style ([#17560](https://github.com/sequelize/sequelize/issues/17560)) ([1f4bdee](https://github.com/sequelize/sequelize/commit/1f4bdee80bb7ab5a335d11681f0a9ea973277297))

### BREAKING CHANGES

- the `bindParam` option has been replaced with `parameterStyle` which defaults to `ParameterStyle.BIND`
