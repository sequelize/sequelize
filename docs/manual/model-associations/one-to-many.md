# Associations: One-to-Many  

The most common association is a simple One-to-Many association also called a "has-many-belongs-to" association. This sets up a parent-child relationship. SQL databases are great for doing relationships like this using a foreign key column.

## Defining Association

First you'll have to add a foreign key column through a migration.
```js
'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn(
      'tweets', // name of table
      'userId', // name of key we are adding
      {
        type: Sequelize.INTEGER,
        references: { //Required field
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      }
    )
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('tweets', 'userId');
  }
};

```

Once you have the foreign key column defined then you can add the `.hasMany()` function to the parent model, and `.belongsTo()` to the child model. These will enable the getter and setter functions you'll use to fetch the parent or children from an instance of either model.

Let's look at an example where "users have many tweets" and "tweets belong to users":

```js
// db/index.js

User.hasMany(Tweet);
Tweet.belongsTo(User);
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

The model association can also be declared with an alias:

```js
  Tweet.belongsTo(User, {
    as: 'author' //authorId
  });

  let author = await tweet.getAuthor();
```

Here is a full example using express fetching one parent resource, and then its children.

```js
const models  = require('../db/models');

//POSTS#SHOW
app.get('/posts/:id', async (req, res, next) => {
  try {
    let post = await models.Post.findByPk(req.params.id);
    let comments = await post.getComments({ order: [['createdAt', 'DESC']] });
  } catch (err) {
    console.log(err);
  }

  res.render('posts-show', { post, comments });
});
```

## onDelete

The `onDelete` option defines if there ought to be any action one an instance of a model is deleted.

```js
Category.hasMany(models.Product, { onDelete: 'cascade' });
```
