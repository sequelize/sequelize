Sequelize is a promise-based Node.js ORM for Postgres, MySQL, SQLite and MariaDB. It features solid transaction support, relations, read replication and more. 

## Installation
```bash
$ npm install sequelize --save

# And one of the following:
$ npm install pg
$ npm install mysql
$ npm install mariasql
$ npm install sqlite3
```

## Example usage
```js    
var Sequelize = require('sequelize')
  , sequelize = new Sequelize('database', 'username', 'password');

var User = sequelize.define('User', {
  username: Sequelize.STRING,
  birthday: Sequelize.DATE
});

return sequelize.sync().then(function() {
  return User.create({
    username: 'sdepold',
    birthday: new Date(1986, 06, 28)
  }).then(function(sdepold) {
    console.log(sdepold.values)
  });
});
```