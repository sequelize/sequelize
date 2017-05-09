![logo](manual/asset/logo-small.png)
<span class="sequelize">Sequelize</span>

Sequelize is a promise-based ORM for Node.js. It supports the dialects PostgreSQL, MySQL, SQLite, Oracle and MSSQL and features solid transaction support, relations, read replication and
more.
[![Travis build](https://img.shields.io/travis/sequelize/sequelize/master.svg?style=flat-square)](https://travis-ci.org/sequelize/sequelize)
[![npm](https://img.shields.io/npm/dm/sequelize.svg?style=flat-square)](https://npmjs.org/package/sequelize)
[![npm](https://img.shields.io/npm/v/sequelize.svg?style=flat-square)](https://github.com/sequelize/sequelize/releases)


[Installation](manual/installation/getting-started)

## Example usage

```js
var Sequelize = require('sequelize');
var sequelize = new Sequelize('database', 'username', 'password');

var User = sequelize.define('user', {
  username: Sequelize.STRING,
  birthday: Sequelize.DATE
});

sequelize.sync().then(function() {
  return User.create({
    username: 'janedoe',
    birthday: new Date(1980, 6, 20)
  });
}).then(function(jane) {
  console.log(jane.get({
    plain: true
  }));
});
```
