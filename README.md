# Sequelize

[![npm version](https://img.shields.io/npm/v/sequelize.svg)](https://www.npmjs.com/package/sequelize)
[![Build Status](https://travis-ci.org/sequelize/sequelize.svg?branch=master)](https://travis-ci.org/sequelize/sequelize)
[![Windows Build status](https://ci.appveyor.com/api/projects/status/9l1ypgwsp5ij46m3/branch/master?svg=true)](https://ci.appveyor.com/project/sushantdhiman/sequelize/branch/master)
[![codecov](https://codecov.io/gh/sequelize/sequelize/branch/master/graph/badge.svg)](https://codecov.io/gh/sequelize/sequelize)
[![Bountysource](https://www.bountysource.com/badge/team?team_id=955&style=bounties_received)](https://www.bountysource.com/teams/sequelize/issues?utm_source=Sequelize&utm_medium=shield&utm_campaign=bounties_received)
[![Slack Status](http://sequelize-slack.herokuapp.com/badge.svg)](http://sequelize-slack.herokuapp.com/)
[![npm downloads](https://img.shields.io/npm/dm/sequelize.svg?maxAge=2592000)](https://www.npmjs.com/package/sequelize)
![node](https://img.shields.io/node/v/sequelize.svg)
[![License](https://img.shields.io/npm/l/sequelize.svg?maxAge=2592000?style=plastic)](https://github.com/sequelize/sequelize/blob/master/LICENSE)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Greenkeeper badge](https://badges.greenkeeper.io/sequelize/sequelize.svg)](https://greenkeeper.io/)

Sequelize is a promise-based Node.js ORM for Postgres, MySQL, SQLite and Microsoft SQL Server. It features solid transaction support, relations, read replication and more.

## v5 Beta Release

We have started v5 beta release process. Hopefully this will cover full [v5 milestone](https://github.com/sequelize/sequelize/milestone/18). You can find upgrade guide and changelog [here](https://github.com/sequelize/sequelize/blob/master/docs/upgrade-to-v5.md)

```bash
npm install --save sequelize # will install v4
npm install --save sequelize@next # will install v5-beta
```

## Table of Contents
- [Installation](#installation)
- [Features](#features)
- [Responsible disclosure](#responsible-disclosure)
- [Documentation](#documentation)
- [Resources](#resources)

## Installation

```bash
$ npm install --save sequelize

# And one of the following:
$ npm install --save pg pg-hstore
$ npm install --save mysql2
$ npm install --save sqlite3
$ npm install --save tedious # MSSQL
```

Sequelize follows [SEMVER](http://semver.org). Supports Node v4 and above to use ES6 features.

## Features

- Schema definition
- Schema synchronization/dropping
- 1:1, 1:M & N:M Associations
- Through models
- Promises
- Hooks/lifecycle events
- Prefetching/association including
- Transactions
- Migrations
- CLI ([sequelize-cli](https://github.com/sequelize/cli))

## Responsible disclosure
If you have any security issue to report, contact project maintainers privately. You can find contact information [here](https://github.com/sequelize/sequelize/blob/master/CONTACT.md)

## Documentation
- [v4 Documentation](http://docs.sequelizejs.com)
- [v3 Documentation](https://sequelize.readthedocs.io/en/v3/)
- [v3 to v4 Upgrade Guide](http://docs.sequelizejs.com/manual/tutorial/upgrade-to-v4.html)
- [v4 to v5(beta) Upgrade Guide](https://github.com/sequelize/sequelize/blob/master/docs/upgrade-to-v5.md)

## Resources
- [Contributing](https://github.com/sequelize/sequelize/blob/master/CONTRIBUTING.md)
- [Changelog](https://github.com/sequelize/sequelize/releases)
- [Slack](http://sequelize-slack.herokuapp.com/)
- [Google Groups](https://groups.google.com/forum/#!forum/sequelize)

### Tools
- [Sequelize & TypeScript](https://github.com/RobinBuschmann/sequelize-typescript)
- [Sequelize & GraphQL](https://github.com/mickhansen/graphql-sequelize)
- [Add-ons & Plugins](https://github.com/sequelize/sequelize/wiki/Add-ons-&-Plugins)

### Learning
- [Getting Started](http://docs.sequelizejs.com/manual/installation/getting-started)
- [Express Example](https://github.com/sequelize/express-example)

### Translations
- [English v4](http://docs.sequelizejs.com) (OFFICIAL)
- [中文文档 v4](https://github.com/demopark/sequelize-docs-Zh-CN) (UNOFFICIAL)

