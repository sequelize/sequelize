<div>
  <div class="center logo">
    ![logo](manual/asset/logo-small.png)
  </div>
  <div class="center sequelize">Sequelize</div>
</div>

[![npm version](https://badgen.net/npm/v/sequelize)](https://www.npmjs.com/package/sequelize)
[![Build Status](https://github.com/sequelize/sequelize/workflows/CI/badge.svg)](https://github.com/sequelize/sequelize/actions?query=workflow%3ACI)
[![npm downloads](https://badgen.net/npm/dm/sequelize)](https://www.npmjs.com/package/sequelize)
[![sponsor](https://img.shields.io/opencollective/all/sequelize?label=sponsors)](https://opencollective.com/sequelize)
[![Last commit](https://badgen.net/github/last-commit/sequelize/sequelize)](https://github.com/sequelize/sequelize)
[![Merged PRs](https://badgen.net/github/merged-prs/sequelize/sequelize)](https://github.com/sequelize/sequelize)
[![GitHub stars](https://badgen.net/github/stars/sequelize/sequelize)](https://github.com/sequelize/sequelize)
[![Slack Status](http://sequelize-slack.herokuapp.com/badge.svg)](http://sequelize-slack.herokuapp.com/)
[![node](https://badgen.net/npm/node/sequelize)](https://www.npmjs.com/package/sequelize)
[![License](https://badgen.net/github/license/sequelize/sequelize)](https://github.com/sequelize/sequelize/blob/main/LICENSE)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

Sequelize is a promise-based [Node.js](https://nodejs.org/en/about/) [ORM tool](https://en.wikipedia.org/wiki/Object-relational_mapping) for [Postgres](https://en.wikipedia.org/wiki/PostgreSQL), [MySQL](https://en.wikipedia.org/wiki/MySQL), [MariaDB](https://en.wikipedia.org/wiki/MariaDB), [SQLite](https://en.wikipedia.org/wiki/SQLite) and [Microsoft SQL Server](https://en.wikipedia.org/wiki/Microsoft_SQL_Server). It features solid transaction support, relations, eager and lazy loading, read replication and more.

Sequelize follows [Semantic Versioning](http://semver.org) and supports Node v10 and above.

You are currently looking at the **Tutorials and Guides** for Sequelize. You might also be interested in the [API Reference](identifiers.html).

## Quick example

```js
const { Sequelize, Model, DataTypes } = require('sequelize');
const sequelize = new Sequelize('sqlite::memory:');

class User extends Model {}
User.init({
  username: DataTypes.STRING,
  birthday: DataTypes.DATE
}, { sequelize, modelName: 'user' });

(async () => {
  await sequelize.sync();
  const jane = await User.create({
    username: 'janedoe',
    birthday: new Date(1980, 6, 20)
  });
  console.log(jane.toJSON());
})();
```

To learn more about how to use Sequelize, read the tutorials available in the left menu. Begin with [Getting Started](manual/getting-started.html).

## Supporting the project

Do you like Sequelize and would like to give back to the engineering team behind it?

We have recently created an [OpenCollective based money pool](https://opencollective.com/sequelize) which is shared amongst all core maintainers based on their contributions. Every support is wholeheartedly welcome. ❤️
