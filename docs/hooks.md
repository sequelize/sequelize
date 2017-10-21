# Hooks

Hooks (also known as lifecycle events), are functions which are called before and after calls in sequelize are executed. For example, if you want to always set a value on a model before saving it, you can add a `beforeUpdate` hook.

For a full list of hooks, see [Hooks file](https://github.com/sequelize/sequelize/blob/master/lib/hooks.js#L7).

## Order of Operations

```
(1)
  beforeBulkCreate(instances, options)
  beforeBulkDestroy(options)
  beforeBulkUpdate(options)
(2)
  beforeValidate(instance, options)
(-)
  validate
(3)
  afterValidate(instance, options)
  - or -
  validationFailed(instance, options, error)
(4)
  beforeCreate(instance, options)
  beforeDestroy(instance, options)
  beforeUpdate(instance, options)
  beforeSave(instance, options)
  beforeUpsert(values, options)
(-)
  create
  destroy
  update
(5)
  afterCreate(instance, options)
  afterDestroy(instance, options)
  afterUpdate(instance, options)
  afterSave(instance, options)
  afterUpsert(created, options)
(6)
  afterBulkCreate(instances, options)
  afterBulkDestroy(options)
  afterBulkUpdate(options)
```

## Declaring Hooks
Arguments to hooks are passed by reference. This means, that you can change the values, and this will be reflected in the insert / update statement. A hook may contain async actions - in this case the hook function should return a promise.

There are currently three ways to programmatically add hooks:

```js
// Method 1 via the .define() method
const User = sequelize.define('user', {
  username: DataTypes.STRING,
  mood: {
    type: DataTypes.ENUM,
    values: ['happy', 'sad', 'neutral']
  }
}, {
  hooks: {
    beforeValidate: (user, options) => {
      user.mood = 'happy';
    },
    afterValidate: (user, options) => {
      user.username = 'Toni';
    }
  }
});

// Method 2 via the .hook() method (or its alias .addHook() method)
User.hook('beforeValidate', (user, options) => {
  user.mood = 'happy';
});

User.addHook('afterValidate', 'someCustomName', (user, options) => {
  return sequelize.Promise.reject(new Error("I'm afraid I can't let you do that!"));
});

// Method 3 via the direct method
User.beforeCreate((user, options) => {
  return hashPassword(user.password).then(hashedPw => {
    user.password = hashedPw;
  });
});

User.afterValidate('myHookAfter', (user, options) => {
  user.username = 'Toni';
});
```

## Removing hooks

Only a hook with name param can be removed.

```js
const Book = sequelize.define('book', {
  title: DataTypes.STRING
});

Book.addHook('afterCreate', 'notifyUsers', (book, options) => {
  // ...
});

Book.removeHook('afterCreate', 'notifyUsers');
```

You can have many hooks with same name. Calling `.removeHook()` will remove all of them.

## Global / universal hooks
Global hooks are hooks which are run for all models. They can define behaviours that you want for all your models, and are especially useful for plugins. They can be defined in two ways, which have slightly different semantics:

### Sequelize.options.define (default hook)
```js
const sequelize = new Sequelize(..., {
    define: {
        hooks: {
            beforeCreate: () => {
                // Do stuff
            }
        }
    }
});
```

This adds a default hook to all models, which is run if the model does not define its own `beforeCreate` hook:

```js
const User = sequelize.define('user');
const Project = sequelize.define('project', {}, {
    hooks: {
        beforeCreate: () => {
            // Do other stuff
        }
    }
});

User.create() // Runs the global hook
Project.create() // Runs its own hook (because the global hook is overwritten)
```

### Sequelize.addHook (permanent hook)
```js
sequelize.addHook('beforeCreate', () => {
    // Do stuff
});
```

This hooks is always run before create, regardless of whether the model specifies its own `beforeCreate` hook:


```js
const User = sequelize.define('user');
const Project = sequelize.define('project', {}, {
    hooks: {
        beforeCreate: () => {
            // Do other stuff
        }
    }
});

User.create() // Runs the global hook
Project.create() // Runs its own hook, followed by the global hook
```

Local hooks are always run before global hooks.


### Instance hooks

The following hooks will emit whenever you're editing a single object

```
beforeValidate
afterValidate or validationFailed
beforeCreate / beforeUpdate  / beforeDestroy
afterCreate / afterUpdate / afterDestroy
```

```js
// ...define ...
User.beforeCreate(user => {
  if (user.accessLevel > 10 && user.username !== "Boss") {
    throw new Error("You can't grant this user an access level above 10!")
  }
})
```

This example will return an error:

```js
User.create({username: 'Not a Boss', accessLevel: 20}).catch(err => {
  console.log(err); // You can't grant this user an access level above 10!
});
```

The following example would return successful:

```js
User.create({username: 'Boss', accessLevel: 20}).then(user => {
  console.log(user); // user object with username as Boss and accessLevel of 20
});
```

### Model hooks

Sometimes you'll be editing more than one record at a time by utilizing the `bulkCreate, update, destroy` methods on the model. The following will emit whenever you're using one of those methods:

```
beforeBulkCreate(instances, options)
beforeBulkUpdate(options)
beforeBulkDestroy(options)
afterBulkCreate(instances, options)
afterBulkUpdate(options)
afterBulkDestroy(options)
```

If you want to emit hooks for each individual record, along with the bulk hooks you can pass `individualHooks: true` to the call.

```js
Model.destroy({ where: {accessLevel: 0}, individualHooks: true});
// Will select all records that are about to be deleted and emit before- + after- Destroy on each instance

Model.update({username: 'Toni'}, { where: {accessLevel: 0}, individualHooks: true});
// Will select all records that are about to be updated and emit before- + after- Update on each instance
```

The `options` argument of hook method would be the second argument provided to the corresponding method or its
cloned and extended version.

```js
Model.beforeBulkCreate((records, {fields}) => {
  // records = the first argument sent to .bulkCreate
  // fields = one of the second argument fields sent to .bulkCreate
})

Model.bulkCreate([
    {username: 'Toni'}, // part of records argument
    {username: 'Tobi'} // part of records argument
  ], {fields: ['username']} // options parameter
)

Model.beforeBulkUpdate(({attributes, where}) => {
  // where - in one of the fields of the clone of second argument sent to .update
  // attributes - is one of the fields that the clone of second argument of .update would be extended with
})

Model.update({gender: 'Male'} /*attributes argument*/, { where: {username: 'Tom'}} /*where argument*/)

Model.beforeBulkDestroy(({where, individualHooks}) => {
  // individualHooks - default of overridden value of extended clone of second argument sent to Model.destroy
  // where - in one of the fields of the clone of second argument sent to Model.destroy
})

Model.destroy({ where: {username: 'Tom'}} /*where argument*/)
```

If you use `Model.bulkCreate(...)` with the `updatesOnDuplicate` option, changes made in the hook to fields that aren't given in the `updatesOnDuplicate` array will not be persisted to the database. However it is possible to change the updatesOnDuplicate option inside the hook if this is what you want.

```js
// Bulk updating existing users with updatesOnDuplicate option
Users.bulkCreate([
  { id: 1, isMember: true },
  { id: 2, isMember: false }
], {
  updatesOnDuplicate: ['isMember']
});

User.beforeBulkCreate((users, options) => {
  for (const user of users) {
    if (user.isMember) {
      user.memberSince = new Date();
    }
  }

  // Add memberSince to updatesOnDuplicate otherwise the memberSince date wont be
  // saved to the database
  options.updatesOnDuplicate.push('memberSince');
});
```

## Associations

For the most part hooks will work the same for instances when being associated except a few things

1. When using add/set functions the beforeUpdate/afterUpdate hooks will run.
2. The only way to call beforeDestroy/afterDestroy hooks are on associations with `onDelete: 'cascade'` and the option `hooks: true`. For instance:

```js
const Projects = sequelize.define('projects', {
  title: DataTypes.STRING
});

const Tasks = sequelize.define('tasks', {
  title: DataTypes.STRING
});

Projects.hasMany(Tasks, { onDelete: 'cascade', hooks: true });
Tasks.belongsTo(Projects);
```

This code will run beforeDestroy/afterDestroy on the Tasks table. Sequelize, by default, will try to optimize your queries as much as possible. When calling cascade on delete, Sequelize will simply execute a

```sql
DELETE FROM `table` WHERE associatedIdentifier = associatedIdentifier.primaryKey
```

However, adding `hooks: true` explicitly tells Sequelize that optimization is not of your concern and will perform a `SELECT` on the associated objects and destroy each instance one by one in order to be able to call the hooks with the right parameters.

If your association is of type `n:m`, you may be interested in firing hooks on the through model when using the `remove` call. Internally, sequelize is using `Model.destroy` resulting in calling the `bulkDestroy` instead of the `before/afterDestroy` hooks on each through instance.

This can be simply solved by passing `{individualHooks: true}` to the `remove` call, resulting on each hook to be called on each removed through instance object.


## A Note About Transactions

Note that many model operations in Sequelize allow you to specify a transaction in the options parameter of the method. If a transaction _is_ specified in the original call, it will be present in the options parameter passed to the hook function. For example, consider the following snippet:

```js
// Here we use the promise-style of async hooks rather than
// the callback.
User.hook('afterCreate', (user, options) => {
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


sequelize.transaction(transaction => {
  User.create({
    username: 'someguy',
    mood: 'happy',
    transaction
  });
});
```

If we had not included the transaction option in our call to `User.update` in the preceding code, no change would have occurred, since our newly created user does not exist in the database until the pending transaction has been committed.

### Internal Transactions

It is very important to recognize that sequelize may make use of transactions internally for certain operations such as `Model.findOrCreate`. If your hook functions execute read or write operations that rely on the object's presence in the database, or modify the object's stored values like the example in the preceding section, you should always specify `{ transaction: options.transaction }`.

If the hook has been called in the process of a transacted operation, this makes sure that your dependent read/write is a part of that same transaction. If the hook is not transacted, you have simply specified `{ transaction: null }` and can expect the default behaviour.
