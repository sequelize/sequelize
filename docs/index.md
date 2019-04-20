<div>
  <div class="center logo">
    ![logo](/manual/asset/logo-small.png)
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
[![Bountysource](https://www.bountysource.com/badge/team?team_id=955&style=bounties_received)](https://www.bountysource.com/teams/sequelize/issues?utm_source=Sequelize&utm_medium=shield&utm_campaign=bounties_received)
[![Slack Status](http://sequelize-slack.herokuapp.com/badge.svg)](http://sequelize-slack.herokuapp.com/)
[![node](https://badgen.net/npm/node/sequelize)](https://www.npmjs.com/package/sequelize)
[![License](https://badgen.net/github/license/sequelize/sequelize)](https://github.com/sequelize/sequelize/blob/master/LICENSE)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

Sequelize is a promise-based Node.js ORM for Postgres, MySQL, MariaDB, SQLite and Microsoft SQL Server. It features solid transaction support, relations, eager and lazy loading, read replication and more.

Sequelize follows [SEMVER](http://semver.org). Supports Node v6 and above to use ES6 features.

**Sequelize v5** was released on March 13, 2019. [Official TypeScript typings are now included](manual/typescript).

You are currently looking at the **Tutorials and Guides** for Sequelize. You might also be interested in the [API Reference](identifiers).

## Quick example

```js
const Sequelize = require('sequelize');
const sequelize = new Sequelize('postgres://user:pass@example.com:5432/dbname');

class User extends Sequelize.Model {}
User.init({
  username: Sequelize.STRING,
  birthday: Sequelize.DATE
}, { sequelize, modelName: 'user' });

sequelize.sync()
  .then(() => User.create({
    username: 'janedoe',
    birthday: new Date(1980, 6, 20)
  }))
  .then(jane => {
    console.log(jane.toJSON());
  });
```

To learn more about how to use Sequelize, read the tutorials available in the left menu. Begin with [Getting Started](manual/getting-started).
