<p align="center">
  <img src="logo.svg" width="100" alt="Sequelize logo" />
  <h1 align="center"><a href="https://sequelize.org">Sequelize</a></h1>
</p>

[![npm version](https://badgen.net/npm/v/@sequelize/core)](https://www.npmjs.com/package/@sequelize/core)
[![Build Status](https://github.com/sequelize/sequelize/workflows/CI/badge.svg)](https://github.com/sequelize/sequelize/actions?query=workflow%3ACI)
[![npm downloads](https://badgen.net/npm/dm/@sequelize/core)](https://www.npmjs.com/package/@sequelize/core)
[![contributors](https://img.shields.io/github/contributors/sequelize/sequelize)](https://github.com/sequelize/sequelize/graphs/contributors)
[![Open Collective](https://img.shields.io/opencollective/backers/sequelize)](https://opencollective.com/sequelize#section-contributors)
[![sponsor](https://img.shields.io/opencollective/all/sequelize?label=sponsors)](https://opencollective.com/sequelize)
[![Merged PRs](https://badgen.net/github/merged-prs/sequelize/sequelize)](https://github.com/sequelize/sequelize)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Sequelize is an easy-to-use and promise-based [Node.js](https://nodejs.org/en/about/) [ORM tool](https://en.wikipedia.org/wiki/Object-relational_mapping) for [Postgres](https://en.wikipedia.org/wiki/PostgreSQL), [MySQL](https://en.wikipedia.org/wiki/MySQL), [MariaDB](https://en.wikipedia.org/wiki/MariaDB), [SQLite](https://en.wikipedia.org/wiki/SQLite), [DB2](https://en.wikipedia.org/wiki/IBM_Db2_Family), [Microsoft SQL Server](https://en.wikipedia.org/wiki/Microsoft_SQL_Server), [Snowflake](https://www.snowflake.com/), [Oracle DB](https://www.oracle.com/database/) and [Db2 for IBM i](https://www.ibm.com/support/pages/db2-ibm-i). It features solid transaction support, relations, eager and lazy loading, read replication and more.

Would you like to contribute? Read [our contribution guidelines](./CONTRIBUTING.md) to know more. There are many ways to help! 😃

## Features

- Promise-based and easy-to-use
- [New friendly documentation](https://sequelize.org/) with Algolia support
- ESM and CommonJS support
- Supports many databases
- Supports clean directories with separated models and configuration files
- Supports working with multiple database instances easily by creating multiple [Sequelize instance](https://sequelize.org/docs/v6/getting-started/#connecting-to-a-database).
- Javascript & [TypeScript support](https://sequelize.org/docs/v6/other-topics/typescript/)
- [Associations](https://sequelize.org/docs/v6/core-concepts/assocs/)
- [Advanced Associations Concepts](https://sequelize.org/docs/v6/category/advanced-association-concepts/)
- [Sub Queries](https://sequelize.org/docs/v6/other-topics/sub-queries/)
- [Soft Deletes (Paranoid)](https://sequelize.org/docs/v6/core-concepts/paranoid/)
- [Migrations CLI](https://sequelize.org/docs/v6/other-topics/migrations/)
- [Read Replication](https://sequelize.org/docs/v6/other-topics/read-replication/)
- [Connection Pooling](https://sequelize.org/docs/v6/other-topics/connection-pool/)
- [Getters, Setters & Virtuals](https://sequelize.org/docs/v6/core-concepts/getters-setters-virtuals/)
- [Constraints](https://sequelize.org/docs/v6/other-topics/constraints-and-circularities/)
- [Indexes](https://sequelize.org/docs/v6/other-topics/indexes/)
- [Transactions](https://sequelize.org/docs/v6/other-topics/transactions/)
- [Logging](https://sequelize.org/docs/v6/getting-started/#logging)
- [Migrations](https://sequelize.org/docs/v6/other-topics/migrations/)
- [JSON Querying](https://sequelize.org/docs/v6/other-topics/other-data-types/#json-sqlite-mysql-mariadb-oracle-and-postgresql-only)
- [Lifecycle Hooks](https://sequelize.org/docs/v6/other-topics/hooks/)
- [Extending Data Types (Custom Data Types)](https://sequelize.org/docs/v6/other-topics/extending-data-types/)

[And more](https://sequelize.org/)

## :computer: Getting Started

Ready to start using Sequelize? Head to [sequelize.org](https://sequelize.org) to begin!

- [Our Getting Started guide for Sequelize 6 (stable)](https://sequelize.org/docs/v6/getting-started)
- [Our Getting Started guide for Sequelize 7 (alpha)](https://sequelize.org/docs/v7/getting-started)

## :money_with_wings: Supporting the project

Do you like Sequelize and would like to give back to the engineering team behind it?

We have recently created an [OpenCollective based money pool](https://opencollective.com/sequelize) which is shared amongst all core maintainers based on their contributions. Every support is wholeheartedly welcome. ❤️

## :pencil: Major version changelog

Please find upgrade information to major versions here:

- [Upgrade from v5 to v6](https://sequelize.org/docs/v6/other-topics/upgrade-to-v6)
- [Upgrade from v6 to v7](https://sequelize.org/docs/v7/other-topics/upgrade-to-v7)

## :zap: Quick Start

If you are curious about how Sequelize fundamentally works, we will give you a quick start to get started using Sequelize, we will using [SQLite](https://www.sqlite.org/index.html) and [TypeScript](https://www.typescriptlang.org/) (See [Other Topics - TypeScript Section](https://sequelize.org/docs/v6/other-topics/typescript/) for more) for the quick start.

### Prerequisites

- [Node.js](https://nodejs.org/en/) installed on your machine.
- Setup a project with `npm init` or `yarn init` to create a `package.json`.
- You may learn [how to set up a TypeScript project](https://www.typescriptlang.org/download) before get started.
- Add `"type": "module",` to the `package.json` to enables ES6 modules.

> See [Sequelize Versioning Policy](https://sequelize.org/releases/) for the supported version of the prerequisites.

### 1. Setup sequelize and sqlite3

First, navigate to a project with a `package.json` file available.

Next, install the dependencies needed, since we will using SQLite, so we will install `sequelize` and [sqlite3](https://github.com/TryGhost/node-sqlite3).

```sh
npm install sequelize sqlite3
# or
yarn add sequelize sqlite3
```

You can now using the Sequelize and sqlite3 as the driver for SQLite! :tada:

### 2. Testing the database connection

To testing the connection of your database, we need to write the database configuration first, you can create a typescript file named `config.js` inside a folder named `database` to put those configuration.

```typescript
// ./database/config.js
import { Sequelize } from "sequelize";

const sequelize = new Sequelize("app", "", "", { // for quick start purpose, we left the username, and password empty.
  storage: "./database.sqlite", // location of the sqlite .sql file.
  dialect: "sqlite", // we will using the sqlite dialect, with the sqlite3 dependency installed.
  logging: false, // we will keep this false, you can choose other logging options
});

export default sequelize;
```

In this configuration, we already create a simple configuration. As an example, we choose to disable the logging but you can also modify it and choose [other logging options here](https://sequelize.org/docs/v6/getting-started/#logging).

Next, create a new typescript file named `main.js` to test the connection of the database with the configuration made on the configuration file you already created before.

```typescript
// main.js
import sequelize from "./database/config.js";

try {
  await sequelize.authenticate();
  console.log('Connection has been established successfully.');
} catch (error) {
  throw error;
}
```

### 3. Define a model

Once the connection is already established, we can continue to define a model to use, you can create a file named `Todo.js` inside a folder named `models` to put the Model example below.

```typescript
// ./models/Todo.js
import { Model, DataTypes } from "sequelize";
import sequelize from "../database/config.js";

interface TodoAttributes {
  id: string;
  title: string;
  completed: boolean;
}

class Todo extends Model<TodoAttributes> {}

Todo.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    completed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
  },
  {
    sequelize,
  }
);

export default Todo;
```

In this model, we set up some attributes with their options, you can also see that Sequelize provides [a lot of built-in data types](https://sequelize.org/docs/v6/core-concepts/model-basics/#data-types) in the `DataTypes` object that we import. See also [other data types for dialects-specific data types](https://sequelize.org/docs/v6/other-topics/other-data-types/).

### 4. Lets Query!

Back to `main.js` and modify your script like below:

```typescript
// main.js
import sequelize from "./database/config.js";
import Todo from "./models/Todo.js";

try {
  await sequelize.authenticate();
  console.log('Connection has been established successfully.');
} catch (error) {
  throw error;
}

const homeWorkTodo = await Todo.create({
  title: 'Home Work',
  completed: false,
});

const todos = await Todo.findAll();

console.log(todos);
```

Finally, runs `node main.js` and you finish the quick start!

## :book: Resources

- [Documentation](https://sequelize.org)
- [Databases Compatibility Table](https://sequelize.org/releases/)
- [Changelog](https://github.com/sequelize/sequelize/releases)
- [Discussions](https://github.com/sequelize/sequelize/discussions)
- [Slack Inviter](http://sequelize-slack.herokuapp.com/)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/sequelize.js)

### :wrench: Tools

- [CLI](https://github.com/sequelize/cli)
- [With TypeScript](https://sequelize.org/docs/v7/other-topics/typescript)
- [Enhanced TypeScript with decorators](https://github.com/RobinBuschmann/sequelize-typescript)
- [For GraphQL](https://github.com/mickhansen/graphql-sequelize)
- [For CockroachDB](https://github.com/cockroachdb/sequelize-cockroachdb)
- [Awesome Sequelize](https://sequelize.org/docs/v7/other-topics/resources/)
- [For YugabyteDB](https://github.com/yugabyte/sequelize-yugabytedb)

### :speech_balloon: Translations

- [English](https://sequelize.org) (Official)
- [中文文档](https://github.com/demopark/sequelize-docs-Zh-CN) (Unofficial)

## :warning: Responsible disclosure

If you have security issues to report, please refer to our
[Responsible Disclosure Policy](./SECURITY.md) for more details.
