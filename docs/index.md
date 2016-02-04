<div id="teaser-home">
  <image src="images/logo-small.png" alt="Sequelize | The Node.js ORM">
  <span>Sequelize</span>
</div>

Sequelize is a promise-based ORM for Node.js and io.js. It supports the dialects PostgreSQL, MySQL,
MariaDB, SQLite and MSSQL and features solid transaction support, relations, read replication and
more.

[Installation](docs/getting-started/)

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
