Hooks (also known as callbacks or lifecycle events), are functions which are called before and after calls in sequelize are executed. For example, if you want to always set a value on a model before saving it, you can add a `beforeUpdate` hook.

## Order of Operations

```
(1)
  beforeBulkCreate(instances, options, fn)
  beforeBulkDestroy(instances, options, fn)
  beforeBulkUpdate(instances, options, fn)
(2)
  beforeValidate(instance, options, fn)
(-)
  validate
(3)
  afterValidate(instance, options, fn)
(4)
  beforeCreate(instance, options, fn)
  beforeDestroy(instance, options, fn)
  beforeUpdate(instance, options, fn)
(-)
  create
  destroy
  update
(5)
  afterCreate(instance, options, fn)
  afterDestroy(instance, options, fn)
  afterUpdate(instance, options, fn)
(6)
  afterBulkCreate(instances, options, fn)
  afterBulkDestory(instances, options, fn)
  afterBulkUpdate(instances, options, fn)
```

## Declaring Hooks

There are currently three ways to programmatically add hooks. A hook function always runs asynchronousĺy, and can be resolved either by calling a callback (passed as the last argument),
or by returning a promise.

```js
// Method 1 via the .define() method
var User = sequelize.define('User', {
  username: DataTypes.STRING,
  mood: {
    type: DataTypes.ENUM,
    values: ['happy', 'sad', 'neutral']
  }
}, {
  hooks: {
    beforeValidate: function(user, options, fn) {
      user.mood = 'happy'
      fn(null, user)
    },
    afterValidate: function(user, options, fn) {
      user.username = 'Toni'
      fn(null, user)
    }
  }
})

// Method 2 via the .hook() method
var User = sequelize.define('User', {
  username: DataTypes.STRING,
  mood: {
    type: DataTypes.ENUM,
    values: ['happy', 'sad', 'neutral']
  }
})

User.hook('beforeValidate', function(user, options, fn) {
  user.mood = 'happy'
  fn(null, user)
})

User.hook('afterValidate', function(user, options) {
  return sequelize.Promise.reject("I'm afraid I can't let you do that!")
})

// Method 3 via the direct method
var User = sequelize.define('User', {
  username: DataTypes.STRING,
  mood: {
    type: DataTypes.ENUM,
    values: ['happy', 'sad', 'neutral']
  }
})

User.beforeValidate(function(user, options) {
  user.mood = 'happy'
  return sequelize.Promise.resolve(user)
})

User.afterValidate(function(user, options, fn) {
  user.username = 'Toni'
  fn(null, user)
})
```

### Instance hooks

The following hooks will emit whenever you're editing a single object...

```
beforeValidate
afterValidate
beforeCreate / beforeUpdate  / beforeDestroy
afterCreate / afterUpdate / afterDestroy
```

```js
// ...define ...
User.beforeCreate(function(user) {
  if (user.accessLevel > 10 && user.username !== "Boss") {
    throw new Error("You can't grant this user an access level above 10!")
  }
})
```

This example will return an error:

```js
User.create({username: 'Not a Boss', accessLevel: 20}).catch(function(err) {
  console.log(err) // You can't grant this user an access level above 10!
})
```

The following example would return successful:

```js
User.create({username: 'Boss', accessLevel: 20}).then(function(user) {
  console.log(user) // user object with username as Boss and accessLevel of 20
})
```

### Model hooks

Sometimes you'll be editing more than one record at a time by utilizing the `bulkCreate, update, destroy` methods on the model. The following will emit whenever you're using one of those methods.

```
beforeBulkCreate / beforeBulkUpdate / beforeBulkDestroy
afterBulkCreate / afterBulkUpdate / afterBulkDestroy
```

If you want to emit hooks for each individual record, along with the bulk hooks you can pass `individualHooks: true` to the call.

```js
Model.destroy({ where: {accessLevel: 0}, individualHooks: true})
// Will select all records that are about to be deleted and emit before- + after- Destroy on each instance

Model.update({username: 'Toni'}, { where: {accessLevel: 0}, individualHooks: true})
// Will select all records that are about to be updated and emit before- + after- Update on each instance
```

Some model hooks have two or three parameters sent to each hook depending on it's type.

```js
Model.beforeBulkCreate(function(records, fields, fn) {
  // records = the first argument sent to .bulkCreate
  // fields = the second argument sent to .bulkCreate
})

Model.bulkCreate([
  {username: 'Toni'}, // part of records argument
  {username: 'Tobi'} // part of records argument
], ['username'] /* part of fields argument */)

Model.beforeBulkUpdate(function(attributes, where, fn) {
  // attributes = first argument sent to Model.update
  // where = second argument sent to Model.update
})

Model.update({gender: 'Male'} /*attributes argument*/, { where: {username: 'Tom'}} /*where argument*/)

Model.beforeBulkDestroy(function(whereClause, fn) {
  // whereClause = first argument sent to Model.destroy
})

Model.destroy({ where: {username: 'Tom'}} /*whereClause argument*/)
```

## Associations

For the most part hooks will work the same for instances when being associated except a few things

1. When using add/set\[s\] functions the beforeUpdate/afterUpdate hooks will run.
2. The only way to call beforeDestroy/afterDestroy hooks are on associations with `onDelete: 'cascade'` and the option `hooks: true`. For instance:
```js
var Projects = sequelize.define('Projects', {
  title: DataTypes.STRING
})

var Tasks = sequelize.define('Tasks', {
  title: DataTypes.STRING
})

Projects.hasMany(Tasks, {onDelete: 'cascade', hooks: true})
Tasks.belongsTo(Projects)
```

This code will run beforeDestroy/afterDestroy on the Tasks table. Sequelize, by default, will try to optimize your queries as much as possible. 
When calling cascade on delete, Sequelize will simply execute a

```sql
DELETE FROM `table` WHERE associatedIdentifiier = associatedIdentifier.primaryKey
```

However, adding `hooks: true` explicitly tells Sequelize that optimization is not of your concern and will perform a `SELECT` on the associated objects and destroy each instance one by one in order to be able to call the hooks with the right parameters.

## Promises and callbacks

Sequelize will look at the function length of your hook callback to determine whether or not you're using callbacks or promises.

```js
// Will stall if the condition isn't met since the callback is never called
User.beforeCreate(function(user, options, callback) {
  if (user.accessLevel > 10 && user.username !== "Boss") {
    return callback("You can't grant this user an access level above 10!");
  }
});

// Will never stall since returning undefined will act as a resolved promise with an undefined value
User.beforeCreate(function(user, options) {
  if (user.accessLevel > 10 && user.username !== "Boss") {
    return throw new Error("You can't grant this user an access level above 10!");
  }
  if (something) {
    return Promise.reject();
  }
});
```

## A Note About Transactions

Note that many model operations in Sequelize allow you to specify a transaction in the options parameter of the method. If a transaction _is_ specified in the original call, it will be present in the options parameter passed to the hook function. For example, consider the following snippet:

```js
// Here we use the promise-style of async hooks rather than
// the callback.
User.hook('afterCreate', function(user, options) {
  // 'transaction' will be available in options.transaction

  // This operation will be part of the same transaction as the
  // original User.create call.
  return User.update({
    mood: 'sad'
  }, {
    where: {
      id: user.id
    },
    transaction: options.transaction
  });
});


sequelize.transaction(function(t) {
  User.create({
    username: 'someguy',
    mood: 'happy',
    transaction: t
  });
});
```

If we had not included the transaction option in our call to `User.update` in the preceding code, no change would have occurred, since our newly created user does not exist in the database until the pending transaction has been committed.

### Internal Transactions

It is very important to recognize that sequelize may make use of transactions internally for certain operations such as `Model.findOrCreate`. If your hook functions execute read or write operations that rely on the object's presence in the database, or modify the object's stored values like the example in the preceding section, you should always specify `{ transaction: options.transaction }`.

If the hook has been called in the process of a transacted operation, this makes sure that your dependent read/write is a part of that same transaction. If the hook is not transacted, you have simply specified `{ transaction: null }` and can expect the default behaviour.
