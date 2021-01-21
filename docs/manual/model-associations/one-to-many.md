# Associations: One-to-Many  

The most common association is a simple One-to-Many association also called a "has-many-belongs-to" association. This sets up a parent-child relationship. SQL databases are great for doing relationships like this using a foreign key column.

## Defining Association

First you'll have to add a foreign key column through a migration. The only way to do this is to chain a `addColumn` function and an `addConstraint` function afterwards.

```js
'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Tweets', 'UserId', Sequelize.INTEGER).then(() => {
      return queryInterface.addConstraint('Tweets', ['UserId'], {
        type: 'foreign key',
        name: 'user_tweets',
        references: { //Required field
          table: 'Users',
          field: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Tweets', 'UserId');
  }
};

```

Once you have the foreign key column defined then you can add the `.hasMany()` function to the parent model, and `.belongsTo()` to the child model. These will enable the getter and setter functions you'll use to fetch the parent or children from an instance of either model.

Let's look at an example where "users have many tweets" and "tweets belong to users"

```js
// USER MODEL
'use strict';

module.exports = (sequelize, DataTypes) => {
  var User = sequelize.define('User', {
    first_name: DataTypes.STRING,
    last_name: DataTypes.STRING,
    bio: DataTypes.TEXT
  })

  User.associate = function(models) {
    User.hasMany(models.Tweet);
  }

  return User;
};
```

```js
// TWEET MODEL
'use strict';

module.exports = (sequelize, DataTypes) => {
  var User = sequelize.define('Tweet', {
    first_name: DataTypes.STRING,
    last_name: DataTypes.STRING,
    bio: DataTypes.TEXT
  })

  Tweet.associate = function(models) {
    Tweet.belongsTo(models.User); // UserId
  }

  return User;
};
```

Now when we have either a `user` or `tweet` instance, we can fetch and set its children or parent, respectively.

```js
user.getTweets();
user.addTweet(tweet1);
user.setTweets([tweet1, tweet2]); //=> sets only two tweets as the children
user.setTweets([]); //=> removes all children
user.hasTweets(); //=> returns true or false

tweet.getUser();
tweet.setUser(user);
tweet.hasUser(); //=> returns true or false
```

You can also set filters to query children, or request only certain attributes.

```js
user.getTweets({ where: 'id > 10' });
user.getTweets({attributes: ['title']});
```
```

The model association can also be declared with an alias:

```js
  Tweet.belongsTo(models.User, { as: 'author' }); // AuthorId
  let author = await tweet.getAuthor();
```

Here is a full example using express fetching one parent resource, and then its children.

```js
const models  = require('../db/models');

//POSTS#SHOW
app.get('/posts/:id', async (req, res, next) => {
  try {
    let post = await models.Post.findById(req.params.id);
    let comments = await post.getComments({ order: [['createdAt', 'DESC']] });
  } catch (err) {
    console.log(err);
  }

  res.render('posts-show', { post: post, comments: comments});
});
```

## Include, or Eager Loading

```js
// Find all the pugs, and include their owner
const pugs = await Pug.findAll({ include: [{ model: Owner }] })
```

**GOTCHA** - the included records will be available only if you capitalize their name `pug.Owner`.

You can add a where query to this and also

You can include either one model as the example above or use the option `all: true` to include all associations. There does not seem to be a way to pick and choose which associated models to include.

```js
// Find one event, and include all its associated models
const event = await Event.findById(eventId, { include: [{ all: true }] });
```

You can also add other options to the include request:

```js
{
  model: User,
  attributes: ['name', 'image'],
  as: "Author",
  where: { isPublished: true }
}
```

## onDelete

The `onDelete` option defines if there ought to be any action one an instance of a model is deleted.

```js
Category.hasMany(models.Product, { onDelete: 'cascade' });
```
