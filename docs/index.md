<div id="teaser-home">
  <image src="images/logo-small.png" alt="Sequelize | The Node.js ORM">
  <span>Sequelize</span>
</div>

[Installation](http://sequelize.readthedocs.org/en/latest/docs/getting-started/)

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
