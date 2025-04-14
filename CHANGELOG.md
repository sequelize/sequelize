# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [7.0.0-alpha.46](https://github.com/sequelize/sequelize/compare/v7.0.0-alpha.45...v7.0.0-alpha.46) (2025-03-22)

### Bug Fixes

- **cli:** remove redundant types export in package.json ([#17781](https://github.com/sequelize/sequelize/issues/17781)) ([2391263](https://github.com/sequelize/sequelize/commit/2391263eaa09ae8c3fe1ce624b3f696ccfae8501))
- **core:** fix issues with composite PK in `findByPk` ([#17747](https://github.com/sequelize/sequelize/issues/17747)) ([dd587cb](https://github.com/sequelize/sequelize/commit/dd587cb86a1b636cdc9cc490c9325e2f6e7640a8))
- **core:** fix msg of error thrown when decorating a non-model ([#17745](https://github.com/sequelize/sequelize/issues/17745)) ([c43c270](https://github.com/sequelize/sequelize/commit/c43c2708d75535edd0fd78e990884a3e38f2fb0d))
- **core:** proper check upsert support in query-interface ([#17358](https://github.com/sequelize/sequelize/issues/17358)) ([68d7d75](https://github.com/sequelize/sequelize/commit/68d7d758671e0f80bafd68c6980be9dc818683fd))
- **postgres:** correct existing enum type matching ([#17576](https://github.com/sequelize/sequelize/issues/17576)) ([425d217](https://github.com/sequelize/sequelize/commit/425d21718af40f86015f6496ea6cf721cc61b981))
- **postgres:** update to postgres 17 ([#17740](https://github.com/sequelize/sequelize/issues/17740)) ([b5c2b26](https://github.com/sequelize/sequelize/commit/b5c2b2667004b3b27e5634c677507f5593987938))
- update typescript to v5.8.2 ([#17728](https://github.com/sequelize/sequelize/issues/17728)) ([6c5a82d](https://github.com/sequelize/sequelize/commit/6c5a82dbc82ec45bbe85112c51e1b496f3f7dbaa))

### Features

- **core:** add `sql.join` & improve `sql.identifier` ([#17744](https://github.com/sequelize/sequelize/issues/17744)) ([e914861](https://github.com/sequelize/sequelize/commit/e914861c084ef0ed8f12ca7b59be4965326e9641))
- **core:** count grouped rows ([#17751](https://github.com/sequelize/sequelize/issues/17751)) ([a396673](https://github.com/sequelize/sequelize/commit/a396673b4edad0d3d3379111a3b1cbf3695d22cc))
