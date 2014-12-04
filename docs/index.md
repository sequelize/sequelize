The Sequelize library provides easy access to MySQL, MariaDB, SQLite or PostgreSQL databases by mapping database entries to objects and vice versa. To put it in a nutshell, it's an ORM (Object-Relational-Mapper). The library is written entirely in JavaScript and can be used in the Node.JS environment.

## Easy installation 
```bash
$ npm install sequelize
$ npm install mysql
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