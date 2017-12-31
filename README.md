# Sequelize Next

[![npm version](https://img.shields.io/npm/v/sequelize-next.svg)](https://www.npmjs.com/package/sequelize-next)
[![Build Status](https://travis-ci.org/eggjs/sequelize.svg?branch=master)](https://travis-ci.org/eggjs/sequelize)
[![Windows Build status](https://ci.appveyor.com/api/projects/status/9l1ypgwsp5ij46m3/branch/master?svg=true)](https://ci.appveyor.com/project/sushantdhiman/sequelize/branch/master)
[![codecov](https://codecov.io/gh/eggjs/sequelize/branch/master/graph/badge.svg)](https://codecov.io/gh/eggjs/sequelize)
[![npm downloads](https://img.shields.io/npm/dm/sequelize-next.svg?maxAge=2592000)](https://www.npmjs.com/package/sequelize-next)
![node](https://img.shields.io/node/v/sequelize.svg)
[![License](https://img.shields.io/npm/l/sequelize.svg?maxAge=2592000?style=plastic)](https://github.com/eggjs/sequelize/blob/master/LICENSE)

Sequelize is a promise-based Node.js ORM for Postgres, MySQL, SQLite and Microsoft SQL Server. It features solid transaction support, relations, read replication and more.

## sequelize-next forked

**sequelize-next is forked from Sequelize, to make Sequelize using easily on egg.js**

These are some new features:

- ConextModel class
- `beforeQuery` and `afterQuery` hooks on global `sequelize` instance
- only support Node.js >= 6.0.0

## Table of Contents
- [Installation](#installation)
- [Features](#features)
- [Responsible disclosure](#responsible-disclosure)
- [Documentation](#documentation)
- [Resources](#resources)

## Installation

```bash
$ npm install --save sequelize-next

# And one of the following:
$ npm install --save pg@6 pg-hstore # Note that `pg@7` is not supported yet
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
- Hooks/callbacks/lifecycle events
- Prefetching/association including
- Transactions
- Migrations
- CLI ([sequelize-cli](https://github.com/sequelize/cli))

## Responsible disclosure
If you have any security issue to report, contact project maintainers privately. You can find contact information [here](https://github.com/sequelize/sequelize/blob/master/CONTACT.md)

## Documentation
- [Contributing](https://github.com/sequelize/sequelize/blob/master/CONTRIBUTING.md)
- [v4 Documentation](http://docs.sequelizejs.com)
- [v3 Documentation](https://sequelize.readthedocs.io/en/v3/)
- [v3 to v4 Upgrade Guide](http://docs.sequelizejs.com/manual/tutorial/upgrade-to-v4.html)

## Resources
- [Changelog](https://github.com/sequelize/sequelize/releases)
- [Slack](http://sequelize-slack.herokuapp.com/)
- [Google Groups](https://groups.google.com/forum/#!forum/sequelize)

### Tools
- [Add-ons & Plugins](https://github.com/sequelize/sequelize/wiki/Add-ons-&-Plugins)
- [Sequelize & TypeScript](https://github.com/RobinBuschmann/sequelize-typescript)

### Learning
- [Getting Started](http://docs.sequelizejs.com/manual/installation/getting-started)
- [Express Example](https://github.com/sequelize/express-example)


### Translations
- [English v4](http://docs.sequelizejs.com) (OFFICIAL)
- [中文文档 v4](https://github.com/demopark/sequelize-docs-Zh-CN) (UNOFFICIAL)
