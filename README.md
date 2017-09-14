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

## Table of Contents
- [Installation](#installation)
- [Features](#features)
- [Documentation](#documentation)
- [Responsible disclosure](#responsible-disclosure)
- [Resources](#resources)

## Installation

```bash
$ npm install --save sequelize

# And one of the following:
$ npm install --save pg pg-hstore
$ npm install --save mysql2
$ npm install --save sqlite3
$ npm install --save tedious // MSSQL
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

## Documentation

- [Stable v4 documentation](http://docs.sequelizejs.com)
- [Upgrading from v3 to v4](http://docs.sequelizejs.com/manual/tutorial/upgrade-to-v4.html)
- [v3 documentation](https://sequelize.readthedocs.io/en/v3/)

## Responsible disclosure
If you have any security issue to report, contact project maintainers privately. You can find contact information [here](https://github.com/sequelize/sequelize/blob/master/CONTACT.md)

## Resources
- [Changelog](https://github.com/sequelize/sequelize/releases)
- [Getting Started](http://docs.sequelizejs.com/manual/installation/getting-started)
- [Contributing](https://github.com/sequelize/sequelize/blob/master/CONTRIBUTING.md)
- [Express Example](https://github.com/sequelize/express-example)
- [Documentation](http://docs.sequelizejs.com)
- [Slack](http://sequelize-slack.herokuapp.com/)
- [Google Groups](https://groups.google.com/forum/#!forum/sequelize)
- [Add-ons & Plugins](https://github.com/sequelize/sequelize/wiki/Add-ons-&-Plugins)
