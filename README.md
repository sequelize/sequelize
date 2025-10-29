<p align="center"><img src="logo.svg" width="100" alt="Sequelize logo" /></p>
<h1 align="center" style="margin-top: 0;"><a href="https://sequelize.org">Sequelize</a></h1>

[![npm version](https://badgen.net/npm/v/@sequelize/core)](https://www.npmjs.com/package/@sequelize/core)
[![npm downloads](https://badgen.net/npm/dm/@sequelize/core)](https://www.npmjs.com/package/@sequelize/core)
[![contributors](https://img.shields.io/github/contributors/sequelize/sequelize)](https://github.com/sequelize/sequelize/graphs/contributors)
[![Open Collective](https://img.shields.io/opencollective/backers/sequelize)](https://opencollective.com/sequelize#section-contributors)
[![sponsor](https://img.shields.io/opencollective/all/sequelize?label=sponsors)](https://opencollective.com/sequelize)
[![Merged PRs](https://badgen.net/github/merged-prs/sequelize/sequelize)](https://github.com/sequelize/sequelize)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Sequelize is an easy-to-use and promise-based [Node.js](https://nodejs.org/en/about/) [ORM tool](https://en.wikipedia.org/wiki/Object-relational_mapping) for [Postgres](https://en.wikipedia.org/wiki/PostgreSQL), [MySQL](https://en.wikipedia.org/wiki/MySQL), [MariaDB](https://en.wikipedia.org/wiki/MariaDB), [SQLite](https://en.wikipedia.org/wiki/SQLite), [DB2](https://en.wikipedia.org/wiki/IBM_Db2_Family), [Microsoft SQL Server](https://en.wikipedia.org/wiki/Microsoft_SQL_Server), [Snowflake](https://www.snowflake.com/), [Oracle DB](https://www.oracle.com/database/) and [Db2 for IBM i](https://www.ibm.com/support/pages/db2-ibm-i). It features solid transaction support, relations, eager and lazy loading, read replication and more.

Would you like to contribute? Read [our contribution guidelines](./CONTRIBUTING.md) to know more. There are many ways to help! 😃

## 🚀 Seeking New Maintainers for Sequelize! 🚀

We're looking for new maintainers to help finalize and release the next major version of Sequelize! If you're passionate about open-source and database ORMs, we'd love to have you onboard.

### 💰 Funding Available

We distribute **$2,500 per quarter** among maintainers and have additional funds for full-time contributions.

### 🛠️ What You’ll Work On

- Finalizing and releasing Sequelize’s next major version
- Improving TypeScript support and database integrations
- Fixing critical issues and shaping the ORM’s future

### 🤝 How to Get Involved

Interested? Join our Slack and reach out to **@WikiRik** or **@sdepold**:  
➡️ **[sequelize.org/slack](https://sequelize.org/slack)**

We’d love to have you on board! 🚀

## :computer: Getting Started

Ready to start using Sequelize? Head to [sequelize.org](https://sequelize.org) to begin!

- [Our Getting Started guide for Sequelize 6 (stable)](https://sequelize.org/docs/v6/getting-started)
- [Our Getting Started guide for Sequelize 7 (alpha)](https://sequelize.org/docs/v7/getting-started)

## :book: Resources

- [Documentation](https://sequelize.org)
- [Databases Compatibility Table](https://sequelize.org/releases/)
- [Changelog](https://github.com/sequelize/sequelize/releases)
- [Discussions](https://github.com/sequelize/sequelize/discussions)
- [Slack](https://sequelize.org/slack)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/sequelize.js)

### :wrench: Tools

- [CLI](https://github.com/sequelize/cli)
- [For GraphQL](https://github.com/mickhansen/graphql-sequelize)
- [For CockroachDB](https://github.com/cockroachdb/sequelize-cockroachdb)
- [Awesome Sequelize](https://sequelize.org/docs/v7/other-topics/resources/)
- [For YugabyteDB](https://github.com/yugabyte/sequelize-yugabytedb)

## Partition Support

To enable partitioning in your Sequelize model, add a `partition` key to the model definition. In this example, we are using **range partitioning** based on the `created_at` column.

### Example
Add the following code to your Sequelize model file:

```js
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Update this path to match your config

class Event extends Model {}

Event.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    primaryKey: true,
  }
}, {
  sequelize,
  modelName: 'Event',
  partition: {
    type: 'range',        // Partition type: RANGE
    column: 'created_at', // Partition based on 'created_at'
  },
  timestamps: false,      // Disable timestamps if not needed
});

module.exports = Event;
```
