# Model Instances

As you already know, a model is an [ES6 class](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes). An instance of the class represents one object from that model (which maps to one row of the table in the database). This way, model instances are [DAOs](https://en.wikipedia.org/wiki/Data_access_object).

For this guide, the following setup will be assumed:

```js
const { Sequelize, Model, DataTypes } = require("sequelize");
const sequelize = new Sequelize("sqlite::memory:");

const User = sequelize.define("user", {
  name: DataTypes.TEXT,
  favoriteColor: {
    type: DataTypes.TEXT,
    defaultValue: 'green'
  },
  age: DataTypes.INTEGER,
  cash: DataTypes.INTEGER
});

(async () => {
  await sequelize.sync({ force: true });
  // Code here
})();
```

## Creating an instance

Although a model is a class, you should not create instances by using the `new` operator directly. Instead, the [`build`](../class/lib/model.js~Model.html#static-method-build) method should be used:

```js
const jane = User.build({ name: "Jane" });
console.log(jane instanceof User); // true
console.log(jane.name); // "Jane"
```

However, the code above does not communicate with the database at all (note that it is not even asynchronous)! This is because the [`build`](../class/lib/model.js~Model.html#static-method-build) method only creates an object that *represents* data that *can* be mapped to a database. In order to really save (i.e. persist) this instance in the database, the [`save`](../class/lib/model.js~Model.html#instance-method-save) method should be used:

```js
await jane.save();
console.log('Jane was saved to the database!');
```

Note, from the usage of `await` in the snippet above, that `save` is an asynchronous method. In fact, almost every Sequelize method is asynchronous; `build` is one of the very few exceptions.

### A very useful shortcut: the `create` method

Sequelize provides the [`create`](../class/lib/model.js~Model.html#static-method-create) method, which combines the `build` and `save` methods shown above into a single method:

```js
const jane = await User.create({ name: "Jane" });
// Jane exists in the database now!
console.log(jane instanceof User); // true
console.log(jane.name); // "Jane"
```

## Note: logging instances

Trying to log a model instance directly to `console.log` will produce a lot of clutter, since Sequelize instances have a lot of things attached to them. Instead, you can use the `.toJSON()` method (which, by the way, automatically guarantees the instances to be `JSON.stringify`-ed well).

```js
const jane = await User.create({ name: "Jane" });
// console.log(jane); // Don't do this
console.log(jane.toJSON()); // This is good!
console.log(JSON.stringify(jane, null, 4)); // This is also good!
```

## Default values

Built instances will automatically get default values:

```js
const jane = User.build({ name: "Jane" });
console.log(jane.favoriteColor); // "green"
```

## Updating an instance

If you change the value of some field of an instance, calling `save` again will update it accordingly:

```js
const jane = await User.create({ name: "Jane" });
console.log(jane.name); // "Jane"
jane.name = "Ada";
// the name is still "Jane" in the database
await jane.save();
// Now the name was updated to "Ada" in the database!
```

You can update several fields at once with the [`set`](../class/lib/model.js~Model.html#instance-method-set) method:

```js
const jane = await User.create({ name: "Jane" });

jane.set({
  name: "Ada",
  favoriteColor: "blue"
});
// As above, the database still has "Jane" and "green"
await jane.save();
// The database now has "Ada" and "blue" for name and favorite color
```

Note that the `save()` here will also persist any other changes that have been made on this instance, not just those in the previous `set` call. If you want to update a specific set of fields, you can use [`update`](../class/lib/model.js~Model.html#instance-method-update):

```js
const jane = await User.create({ name: "Jane" });
jane.favoriteColor = "blue"
await jane.update({ name: "Ada" })
// The database now has "Ada" for name, but still has the default "green" for favorite color
await jane.save()
// Now the database has "Ada" for name and "blue" for favorite color
```

## Deleting an instance

You can delete an instance by calling [`destroy`](../class/lib/model.js~Model.html#instance-method-destroy):

```js
const jane = await User.create({ name: "Jane" });
console.log(jane.name); // "Jane"
await jane.destroy();
// Now this entry was removed from the database
```

## Reloading an instance

You can reload an instance from the database by calling [`reload`](../class/lib/model.js~Model.html#instance-method-reload):

```js
const jane = await User.create({ name: "Jane" });
console.log(jane.name); // "Jane"
jane.name = "Ada";
// the name is still "Jane" in the database
await jane.reload();
console.log(jane.name); // "Jane"
```

The reload call generates a `SELECT` query to get the up-to-date data from the database.

## Saving only some fields

It is possible to define which attributes should be saved when calling `save`, by passing an array of column names.

This is useful when you set attributes based on a previously defined object, for example, when you get the values of an object via a form of a web app. Furthermore, this is used internally in the `update` implementation. This is how it looks like:

```js
const jane = await User.create({ name: "Jane" });
console.log(jane.name); // "Jane"
console.log(jane.favoriteColor); // "green"
jane.name = "Jane II";
jane.favoriteColor = "blue";
await jane.save({ fields: ['name'] });
console.log(jane.name); // "Jane II"
console.log(jane.favoriteColor); // "blue"
// The above printed blue because the local object has it set to blue, but
// in the database it is still "green":
await jane.reload();
console.log(jane.name); // "Jane II"
console.log(jane.favoriteColor); // "green"
```

## Change-awareness of save

The `save` method is optimized internally to only update fields that really changed. This means that if you don't change anything and call `save`, Sequelize will know that the save is superfluous and do nothing, i.e., no query will be generated (it will still return a Promise, but it will resolve immediately).

Also, if only a few attributes have changed when you call `save`, only those fields will be sent in the `UPDATE` query, to improve performance.

## Incrementing and decrementing integer values

In order to increment/decrement values of an instance without running into concurrency issues, Sequelize provides the [`increment`](../class/lib/model.js~Model.html#instance-method-increment) and [`decrement`](../class/lib/model.js~Model.html#instance-method-decrement) instance methods.

```js
const jane = await User.create({ name: "Jane", age: 100 });
const incrementResult = await jane.increment('age', { by: 2 });
// Note: to increment by 1 you can omit the `by` option and just do `user.increment('age')`

// In PostgreSQL, `incrementResult` will be the updated user, unless the option
// `{ returning: false }` was set (and then it will be undefined).

// In other dialects, `incrementResult` will be undefined. If you need the updated instance, you will have to call `user.reload()`.
```

You can also increment multiple fields at once:

```js
const jane = await User.create({ name: "Jane", age: 100, cash: 5000 });
await jane.increment({
  'age': 2,
  'cash': 100
});

// If the values are incremented by the same amount, you can use this other syntax as well:
await jane.increment(['age', 'cash'], { by: 2 });
```

Decrementing works in the exact same way.
