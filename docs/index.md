The Sequelize library provides easy access to MySQL, MariaDB, SQLite or PostgreSQL databases by mapping database entries to objects and vice versa. To put it in a nutshell, it's an ORM (Object-Relational-Mapper). The library is written entirely in JavaScript and can be used in the Node.JS environment.

## Easy installation 
```bash
$ npm install sequelize
$ npm install mysql
```

## Simple usage
```js    
var Sequelize = require('sequelize')
  , sequelize = new Sequelize('database', 'username', 'password')

var User = sequelize.define('User', {
  username: Sequelize.STRING,
  birthday: Sequelize.DATE
})

sequelize.sync().success(function() {
  User.create({
    username: 'sdepold',
    birthday: new Date(1986, 06, 28)
  }).success(function(sdepold) {
    console.log(sdepold.values)
  })
})
```

## Trusted and used by

[![](/images/shutterstock.png)](docs/misc#shutterstock)
[![](/images/clevertech.png)](docs/misc#clevertech)
[![](/images/metamarkets.png)](docs/misc#metamarkets)
[![](/images/filsh.png)](docs/misc#filsh)

(c) Sascha Depold, [et al.](https://github.com/sequelize/sequelize-doc/graphs/contributors) 2006 - 2014 [Imprint](imprint)