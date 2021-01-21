

For this tutorial, the following setup will be assumed:

```js
const { Sequelize, Op, Model, DataTypes } = require("sequelize");
const sequelize = new Sequelize("sqlite::memory:");

const User = sequelize.define("user", {
  username: {
    type: DataTypes.TEXT,
    allowNull: false,
    unique: true
  },
  hashedPassword: {
    type: DataTypes.STRING(64),
    is: /^[0-9a-f]{64}$/i
  }
});

(async () => {
  await sequelize.sync({ force: true });
  // Code here
})();
```

## Unique Constraint

Our code example above defines a unique constraint on the `username` field:

```js
/* ... */ {
  username: {
    type: DataTypes.TEXT,
    allowNull: false,
    unique: true
  },
} /* ... */
```

When this model is synchronized (by calling `sequelize.sync` for example), the `username` field will be created in the table as `` `name` TEXT UNIQUE``, and an attempt to insert an username that already exists there will throw a `SequelizeUniqueConstraintError`.

## Allowing/disallowing null values

By default, `null` is an allowed value for every column of a model. This can be disabled setting the `allowNull: false` option for a column, as it was done in the `username` field from our code example:

```js
/* ... */ {
  username: {
    type: DataTypes.TEXT,
    allowNull: false,
    unique: true
  },
} /* ... */
```

Without `allowNull: false`, the call `User.create({})` would work.
