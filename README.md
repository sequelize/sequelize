# Sequelize-oracle

## This repository is no longer maintained
## For updates, go to : https://github.com/nhuanhoangduc/cu8-sequelize-oracle

--

[![Bitdeli Badge](https://d2weczhvl823v0.cloudfront.net/lebretr/sequelize-oracle/trend.png)](https://bitdeli.com/free "Bitdeli Badge") 
[![Build Status](https://travis-ci.org/lebretr/sequelize-oracle.svg?branch=master-Oracle)](https://travis-ci.org/lebretr/sequelize-oracle) 
[![Dependency Status](https://david-dm.org/lebretr/sequelize-oracle.png)](https://david-dm.org/lebretr/sequelize-oracle) 
[![Code Climate](https://codeclimate.com/github/lebretr/sequelize-oracle/badges/gpa.svg)](https://codeclimate.com/github/lebretr/sequelize-oracle) 
[![Test Coverage](https://codeclimate.com/github/lebretr/sequelize-oracle/badges/coverage.svg)](https://codeclimate.com/github/lebretr/sequelize-oracle)

Sequelize is a promise-based Node.js/io.js ORM for Postgres, MySQL, MariaDB, SQLite, Microsoft SQL Server and Oracle. It features solid transaction support, relations, read replication and more.

### Note
sequelize-oracle is a fork of [sequelize@master](https://github.com/sequelize/sequelize/tree/master)  
This fork add support of DML statements for Oracle  
If you don't need Oracle support, prefer the original [Sequelize](http://sequelizejs.com/)  
  
Sequelize-oracle@3.0.1-x.x is in development. Only the old version (1.7.10-x.x) is on npmjs registry.  

## Compatibility:
Sequelize-oracle is compatible only with nodejs@0.10 and nodejs@0.12 (with oracledb >= 0.6).  
Sequelize-oracle is only tested with Oracle 11 XE and nodejs@0.10
  
## Installation

The basic install steps are:

- Install oracledb
  - Install the small, free [Oracle Instant Client](http://www.oracle.com/technetwork/database/features/instant-client/index-100365.html) libraries if your database is remote, or have a local database such as the free [Oracle XE](http://www.oracle.com/technetwork/database/database-technologies/express-edition/overview/index.html) release.
  - Run `npm install oracledb` to install from the NPM registry.

  See [INSTALL](https://github.com/oracle/node-oracledb/blob/master/INSTALL.md) for details.

- Install sequelize-oracle
  - Run `npm install sequelize-oracle` to install from the NPM registry.

## Oracledb config in Sequelize-Oracle
  - With Oracledb, the maximum number of rows that are fetched by select query is 100 rows. You can change this parameter with options.maxRows in each query.  
  - In Sequelize, for Raw query, the outFormat parameter for oracledb is OBJECT.  
  - AutoCommit is enable by default. If you don't want autoCommit, use Sequelize Transactions for manage commit et rollback.  


## Limitations:

- DataType: only this dataTypes are managed: 
  - STRING (=VARCHAR2)
  - CHAR
  - DECIMAL (=NUMBER)
  - BIGINT (=NUMBER(19,0))
  - INTEGER
  - FLOAT 
  - DOUBLE
  - UUID (=CHAR 36)
  - DATE (=TIMESTAMP WITH LOCAL TIME ZONE)
  - DATEONLY (=DATETIME) 
  - BOOLEAN (=NUMBER(1))
- Index: index type is not fully managed
  
## Todo:
- ENUM DataType
- improve index for type
- resolve the pb "name column length > 30 char" in nesteed querry
- ...
  
  
  
# Sequelize

[![Build Status](https://travis-ci.org/sequelize/sequelize.svg?branch=master)](https://travis-ci.org/sequelize/sequelize) [![Dependency Status](https://david-dm.org/sequelize/sequelize.svg)](https://david-dm.org/sequelize/sequelize) [![Test Coverage](https://codeclimate.com/github/sequelize/sequelize/badges/coverage.svg)](https://codeclimate.com/github/sequelize/sequelize)
[![Bountysource](https://www.bountysource.com/badge/team?team_id=955&style=bounties_received)](https://www.bountysource.com/teams/sequelize/issues?utm_source=Sequelize&utm_medium=shield&utm_campaign=bounties_received)
[![Flattr this](http://api.flattr.com/button/flattr-badge-large.png)](http://flattr.com/thing/1259407/Sequelize)

Sequelize is a promise-based Node.js/io.js ORM for Postgres, MySQL, MariaDB, SQLite and Microsoft SQL Server. It features solid transaction support, relations, read replication and more.

[Documentation](http://sequelize.readthedocs.org/en/latest/)

## Installation

`npm install sequelize`

From 3.0.0 and up Sequelize will follow SEMVER. 3.0.0 contains important security fixes so we highly recommend that users upgrade.

If you still use 1.7 please prefer to [Upgrading to 2.0](https://github.com/sequelize/sequelize/wiki/Upgrading-to-2.0) and the changelog between 2.0 and 3.0. 2.1 also has a breaking change.

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
