# Sequelize

[![Build Status](https://travis-ci.org/sequelize/sequelize.svg?branch=master)](https://travis-ci.org/sequelize/sequelize) [![Dependency Status](https://david-dm.org/sequelize/sequelize.svg)](https://david-dm.org/sequelize/sequelize) [![Test Coverage](https://codeclimate.com/github/sequelize/sequelize/badges/coverage.svg)](https://codeclimate.com/github/sequelize/sequelize)
[![Bountysource](https://www.bountysource.com/badge/team?team_id=955&style=bounties_received)](https://www.bountysource.com/teams/sequelize/issues?utm_source=Sequelize&utm_medium=shield&utm_campaign=bounties_received)
[![Flattr this](http://api.flattr.com/button/flattr-badge-large.png)](http://flattr.com/thing/1259407/Sequelize)

Sequelize is a promise-based Node.js/io.js ORM for Postgres, MySQL, MariaDB, SQLite and Microsoft SQL Server. It features solid transaction support, relations, read replication and more.

[Documentation](http://sequelize.readthedocs.org/en/latest/)

## Installation

`npm install sequelize`

From 3.0.0 and up Sequelize will follow SEMVER.

## Backwards compatibility changes

3.0.0 cleans up a lot of deprecated code, making it easier for us to develop and maintain features in the future. This implies that most of the changes in 3.0.0 are breaking changes! Please read the changelog for 3.0.0 carefully.
[Upgrading to 3.0](https://github.com/sequelize/sequelize/wiki/Upgrading-to-3.0).
We highly recommend to use 3.0 as it also includes security related fixes that can't be backported to either 2.0 or 1.7.

If you still use 1.7 please read our guide [Upgrading to 2.0](https://github.com/sequelize/sequelize/wiki/Upgrading-to-2.0) plus the changelog up to now. Version 2.1 also contained new breaking changes.

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

## Resources
- [Changelog](https://github.com/sequelize/sequelize/blob/master/changelog.md)
- [Getting Started](http://docs.sequelizejs.com/en/latest/docs/getting-started/)
- [Documentation](http://docs.sequelizejs.com/en/latest/)
- [API Reference](http://docs.sequelizejs.com/en/latest/)
- [Collaboration and pull requests](https://github.com/sequelize/sequelize/blob/master/CONTRIBUTING.md)
- [Roadmap](https://github.com/sequelize/sequelize/issues/2869)
- [Twitter](https://twitter.com/SequelizeJS): @SequelizeJS
- [IRC](http://webchat.freenode.net?channels=sequelizejs): sequelizejs on Freenode
- [Google Groups](https://groups.google.com/forum/#!forum/sequelize)
- [Add-ons & Plugins](https://github.com/sequelize/sequelize/wiki/Add-ons-&-Plugins)
