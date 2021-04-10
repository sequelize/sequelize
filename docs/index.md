<div>
  <div class="center logo">
    ![logo](manual/asset/logo-small.png)
  </div>
  <div class="center sequelize">Sequelize</div>
</div>

[![npm version](https://badgen.net/npm/v/sequelize)](https://www.npmjs.com/package/sequelize)
[![Travis Build Status](https://badgen.net/travis/sequelize/sequelize?icon=travis)](https://travis-ci.org/sequelize/sequelize)
[![Appveyor Build Status](https://ci.appveyor.com/api/projects/status/9l1ypgwsp5ij46m3/branch/master?svg=true)](https://ci.appveyor.com/project/sushantdhiman/sequelize/branch/master)
[![npm downloads](https://badgen.net/npm/dm/sequelize)](https://www.npmjs.com/package/sequelize)
[![codecov](https://badgen.net/codecov/c/github/sequelize/sequelize?icon=codecov)](https://codecov.io/gh/sequelize/sequelize)
[![Last commit](https://badgen.net/github/last-commit/sequelize/sequelize)](https://github.com/sequelize/sequelize)
[![Merged PRs](https://badgen.net/github/merged-prs/sequelize/sequelize)](https://github.com/sequelize/sequelize)
[![GitHub stars](https://badgen.net/github/stars/sequelize/sequelize)](https://github.com/sequelize/sequelize)
[![Slack Status](http://sequelize-slack.herokuapp.com/badge.svg)](http://sequelize-slack.herokuapp.com/)
[![node](https://badgen.net/npm/node/sequelize)](https://www.npmjs.com/package/sequelize)
[![License](https://badgen.net/github/license/sequelize/sequelize)](https://github.com/sequelize/sequelize/blob/master/LICENSE)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

Sequelize is a promise-based, asynchronous Node.js [ORM](https://en.wikipedia.org/wiki/Object-relational_mapping) for [Postgres](https://en.wikipedia.org/wiki/PostgreSQL), [MySQL](https://en.wikipedia.org/wiki/MySQL), [MariaDB](https://en.wikipedia.org/wiki/MariaDB), [SQLite](https://en.wikipedia.org/wiki/SQLite) and [Microsoft SQL Server](https://en.wikipedia.org/wiki/Microsoft_SQL_Server). It features solid transaction support, relations, eager and lazy loading, read replication and more.

Sequelize follows [Semantic Versioning](http://semver.org) and supports Node v10 and above.

You are currently looking at the **Tutorials and Guides** for Sequelize. You might also be interested in the [API Reference](identifiers.html).

If you want to see some examples of Sequelize and Express, go check out our [sequelize/express-example](https://github.com/sequelize/express-example) repo.

## Rapid Development Options

Sequelize and its library ecosystem accelerates development and integration with new and existing SQL databases.

* Sequelize-CLI is a commandline tool separate from Sequelize that is required to generate and run migrations. It also has generators that can be used to initiate projects and create model, migration, and seed files.
* `sequelize.sync()` is a method that enables rapid prototyping by creating and structuring your SQL database on the fly based on the definition of your Sequelize models. This makes writing migrations unnecessary in your development environment.
* [Sequelize-Auto](https://github.com/sequelize/sequelize-auto) is a library built for rapidly integrating an existing SQL database with your sequelize implementation.

## Ultralight Sequelize Implementation

```js
// CONNECT TO DB
const { Sequelize, Model, DataTypes } = require('sequelize');
const sequelize = new Sequelize('sqlite::memory:');

// DEFINE A MODEL
class User extends Model {}

User.init({
  username: DataTypes.STRING,
  birthday: DataTypes.DATE
}, { sequelize, modelName: 'user' });

(async () => {

  // BOOSTRAP DB WITH SYNC
  await sequelize.sync();

  // SAVE A RECORD
  const jane = await User.create({
    username: 'janedoe',
    birthday: new Date(1980, 6, 20)
  });

  console.log(jane.toJSON());

})();
```

To learn more about how to use Sequelize, read the tutorials available in the left menu. You could begin with the [Ultralight Guide](manual/ultralight-guide.html) or the [Standard Guide](manual/standard-guide.md).
