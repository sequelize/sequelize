# Getters, Setters & Virtuals

Sequelize allows you to define custom getters and setters for the attributes of your models.

Sequelize also allows you to specify the so-called *virtual attributes*, which are attributes on the Sequelize Model that doesn't really exist in the underlying SQL table, but instead are populated automatically by Sequelize. They are very useful for simplifying code, for example.

## Getters

A getter is a `get()` function defined for one column in the model definition:

```js
const User = sequelize.define('user', {
  // Let's say we wanted to see every username in uppercase, even
  // though they are not necessarily uppercase in the database itself
  username: {
    type: DataTypes.STRING,
    get() {
      const rawValue = this.getDataValue('username');
      return rawValue ? rawValue.toUpperCase() : null;
    }
  }
});
```

This getter, just like a standard JavaScript getter, is called automatically when the field value is read:

```js
const user = User.build({ username: 'SuperUser123' });
console.log(user.username); // 'SUPERUSER123'
console.log(user.getDataValue('username')); // 'SuperUser123'
```

Note that, although `SUPERUSER123` was logged above, the value truly stored in the database is still `SuperUser123`. We used `this.getDataValue('username')` to obtain this value, and converted it to uppercase.

Had we tried to use `this.username` in the getter instead, we would have gotten an infinite loop! This is why Sequelize provides the `getDataValue` method.

## Setters

A setter is a `set()` function defined for one column in the model definition. It receives the value being set:

```js
const User = sequelize.define('user', {
  username: DataTypes.STRING,
  password: {
    type: DataTypes.STRING,
    set(value) {
      // Storing passwords in plaintext in the database is terrible.
      // Hashing the value with an appropriate cryptographic hash function is better.
      this.setDataValue('password', hash(value));
    }
  }
});
```

```js
const user = User.build({ username: 'someone', password: 'NotSo§tr0ngP4$SW0RD!' });
console.log(user.password); // '7cfc84b8ea898bb72462e78b4643cfccd77e9f05678ec2ce78754147ba947acc'
console.log(user.getDataValue('password')); // '7cfc84b8ea898bb72462e78b4643cfccd77e9f05678ec2ce78754147ba947acc'
```

Observe that Sequelize called the setter automatically, before even sending data to the database. The only data the database ever saw was the already hashed value.

If we wanted to involve another field from our model instance in the computation, that is possible and very easy!

```js
const User = sequelize.define('user', {
  username: DataTypes.STRING,
  password: {
    type: DataTypes.STRING,
    set(value) {
      // Storing passwords in plaintext in the database is terrible.
      // Hashing the value with an appropriate cryptographic hash function is better.
      // Using the username as a salt is better.
      this.setDataValue('password', hash(this.username + value));
    }
  }
});
```

**Note:** The above examples involving password handling, although much better than simply storing the password in plaintext, are far from perfect security. Handling passwords properly is hard, everything here is just for the sake of an example to show Sequelize functionality. We suggest involving a cybersecurity expert and/or reading [OWASP](https://www.owasp.org/) documents and/or visiting the [InfoSec StackExchange](https://security.stackexchange.com/).

## Combining getters and setters

Getters and setters can be both defined in the same field.

For the sake of an example, let's say we are modeling a `Post`, whose `content` is a text of unlimited length. To improve memory usage, let's say we want to store a gzipped version of the content.

*Note: modern databases should do some compression automatically in these cases. Please note that this is just for the sake of an example.*

```js
const { gzipSync, gunzipSync } = require('zlib');

const Post = sequelize.define('post', {
  content: {
    type: DataTypes.TEXT,
    get() {
      const storedValue = this.getDataValue('content');
      const gzippedBuffer = Buffer.from(storedValue, 'base64');
      const unzippedBuffer = gunzipSync(gzippedBuffer);
      return unzippedBuffer.toString();
    },
    set(value) {
      const gzippedBuffer = gzipSync(value);
      this.setDataValue('content', gzippedBuffer.toString('base64'));
    }
  }
});
```

With the above setup, whenever we try to interact with the `content` field of our `Post` model, Sequelize will automatically handle the custom getter and setter. For example:

```js
const post = await Post.create({ content: 'Hello everyone!' });

console.log(post.content); // 'Hello everyone!'
// Everything is happening under the hood, so we can even forget that the
// content is actually being stored as a gzipped base64 string!

// However, if we are really curious, we can get the 'raw' data...
console.log(post.getDataValue('content'));
// Output: 'H4sIAAAAAAAACvNIzcnJV0gtSy2qzM9LVQQAUuk9jQ8AAAA='
```

## Virtual fields

Virtual fields are fields that Sequelize populates under the hood, but in reality they don't even exist in the database.

For example, let's say we have the `firstName` and `lastName` attributes for a User.

*Again, this is [only for the sake of an example](https://www.kalzumeus.com/2010/06/17/falsehoods-programmers-believe-about-names/).*

It would be nice to have a simple way to obtain the *full name* directly! We can combine the idea of `getters` with the special data type Sequelize provides for this kind of situation: `DataTypes.VIRTUAL`:

```js
const { DataTypes } = require("sequelize");

const User = sequelize.define('user', {
  firstName: DataTypes.TEXT,
  lastName: DataTypes.TEXT,
  fullName: {
    type: DataTypes.VIRTUAL,
    get() {
      return `${this.firstName} ${this.lastName}`;
    },
    set(value) {
      throw new Error('Do not try to set the `fullName` value!');
    }
  }
});
```

The `VIRTUAL` field does not cause a column in the table to exist. In other words, the model above will not have a `fullName` column. However, it will appear to have it!

```js
const user = await User.create({ firstName: 'John', lastName: 'Doe' });
console.log(user.fullName); // 'John Doe'
```

## `getterMethods` and `setterMethods`

Sequelize also provides the `getterMethods` and `setterMethods` options in the model definition to specify things that look like, but aren't exactly the same as, virtual attributes. This usage is discouraged and likely to be deprecated in the future (in favor of using virtual attributes directly).

Example:

```js
const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize('sqlite::memory:');

const User = sequelize.define('user', {
  firstName: DataTypes.STRING,
  lastName: DataTypes.STRING
}, {
  getterMethods: {
    fullName() {
      return this.firstName + ' ' + this.lastName;
    }
  },
  setterMethods: {
    fullName(value) {
      // Note: this is just for demonstration.
      // See: https://www.kalzumeus.com/2010/06/17/falsehoods-programmers-believe-about-names/
      const names = value.split(' ');
      const firstName = names[0];
      const lastName = names.slice(1).join(' ');
      this.setDataValue('firstName', firstName);
      this.setDataValue('lastName', lastName);
    }
  }
});

(async () => {
  await sequelize.sync();
  let user = await User.create({ firstName: 'John',  lastName: 'Doe' });
  console.log(user.fullName); // 'John Doe'
  user.fullName = 'Someone Else';
  await user.save();
  user = await User.findOne();
  console.log(user.firstName); // 'Someone'
  console.log(user.lastName); // 'Else'
})();
```