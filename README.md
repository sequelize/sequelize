# Sequelize

[![License](https://img.shields.io/npm/l/sequelize.svg?maxAge=2592000?style=plastic)](https://github.com/sequelize/sequelize/blob/master/LICENSE)

Sequelize is a promise-based Node.js ORM. This fork supports Postgres only — the MySQL, SQLite and MSSQL dialects have been removed. It features solid transaction support, relations, read replication and more.

## Table of Contents

- [Installation](#installation)
- [Features](#features)
- [Documentation](#documentation)

## Installation

```bash
$ npm install --save sequelize

# And the Postgres driver:
$ npm install --save pg pg-hstore
```

Requires Node v20.20.0 or above.

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

- [Contributing](https://github.com/sequelize/sequelize/blob/master/CONTRIBUTING.md)
- [v4 Documentation](http://docs.sequelizejs.com)

### Learning

- [Getting Started](http://docs.sequelizejs.com/manual/installation/getting-started)
- [Express Example](https://github.com/sequelize/express-example)
