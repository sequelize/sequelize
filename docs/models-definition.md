# Model definition

To define mappings between a model and a table, use the `define` method. Each column must have a datatype, see more about [datatypes][1].

```js
const Project = sequelize.define('project', {
  title: Sequelize.STRING,
  description: Sequelize.TEXT
})

const Task = sequelize.define('task', {
  title: Sequelize.STRING,
  description: Sequelize.TEXT,
  deadline: Sequelize.DATE
})
```

Apart from [datatypes][1], there are plenty of options that you can set on each column.

```js
const Foo = sequelize.define('foo', {
 // instantiating will automatically set the flag to true if not set
 flag: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },

 // default values for dates => current time
 myDate: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },

 // setting allowNull to false will add NOT NULL to the column, which means an error will be
 // thrown from the DB when the query is executed if the column is null. If you want to check that a value
 // is not null before querying the DB, look at the validations section below.
 title: { type: Sequelize.STRING, allowNull: false },

 // Creating two objects with the same value will throw an error. The unique property can be either a
 // boolean, or a string. If you provide the same string for multiple columns, they will form a
 // composite unique key.
 uniqueOne: { type: Sequelize.STRING,  unique: 'compositeIndex' },
 uniqueTwo: { type: Sequelize.INTEGER, unique: 'compositeIndex' },

 // The unique property is simply a shorthand to create a unique constraint.
 someUnique: { type: Sequelize.STRING, unique: true },

 // It's exactly the same as creating the index in the model's options.
 { someUnique: { type: Sequelize.STRING } },
 { indexes: [ { unique: true, fields: [ 'someUnique' ] } ] },

 // Go on reading for further information about primary keys
 identifier: { type: Sequelize.STRING, primaryKey: true },

 // autoIncrement can be used to create auto_incrementing integer columns
 incrementMe: { type: Sequelize.INTEGER, autoIncrement: true },

 // You can specify a custom column name via the 'field' attribute:
 fieldWithUnderscores: { type: Sequelize.STRING, field: 'field_with_underscores' },

 // It is possible to create foreign keys:
 bar_id: {
   type: Sequelize.INTEGER,

   references: {
     // This is a reference to another model
     model: Bar,

     // This is the column name of the referenced model
     key: 'id',

     // This declares when to check the foreign key constraint. PostgreSQL only.
     deferrable: Sequelize.Deferrable.INITIALLY_IMMEDIATE
   }
 },

 // It is possible to add coments on columns for MySQL, PostgreSQL and MSSQL only
 commentMe: {
   type: Sequelize.INTEGER,

   comment: 'This is a column name that has a comment'
 }
})
```

The comment option can also be used on a table, see [model configuration][0].

## Timestamps

By default, Sequelize will add the attributes `createdAt` and `updatedAt` to your model so you will be able to know when the database entry went into the db and when it was updated last.

Note that if you are using Sequelize migrations you will need to add the `createdAt` and `updatedAt` fields to your migration definition:

```js
module.exports = {
  up(queryInterface, Sequelize) {
    return queryInterface.createTable('my-table', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      // Timestamps
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    })
  },
  down(queryInterface, Sequelize) {
    return queryInterface.dropTable('my-table');
  },
}

```

If you do not want timestamps on your models, only want some timestamps, or you are working with an existing database where the columns are named something else, jump straight on to [configuration ][0]to see how to do that.


## Deferrable

When you specify a foreign key column it is optionally possible to declare the deferrable
type in PostgreSQL. The following options are available:

```js
// Defer all foreign key constraint check to the end of a transaction
Sequelize.Deferrable.INITIALLY_DEFERRED

// Immediately check the foreign key constraints
Sequelize.Deferrable.INITIALLY_IMMEDIATE

// Don't defer the checks at all
Sequelize.Deferrable.NOT
```

The last option is the default in PostgreSQL and won't allow you to dynamically change
the rule in a transaction. See [the transaction section](/manual/tutorial/transactions.html#options) for further information.

## Getters & setters

It is possible to define 'object-property' getters and setter functions on your models, these can be used both for 'protecting' properties that map to database fields and for defining 'pseudo' properties.

Getters and Setters can be defined in 2 ways (you can mix and match these 2 approaches):

* as part of a single property definition
* as part of a model options

**N.B:** If a getter or setter is defined in both places then the function found in the relevant property definition will always take precedence.

### Defining as part of a property

```js
const Employee = sequelize.define('employee', {
  name: {
    type: Sequelize.STRING,
    allowNull: false,
    get() {
      const title = this.getDataValue('title');
      // 'this' allows you to access attributes of the instance
      return this.getDataValue('name') + ' (' + title + ')';
    },
  },
  title: {
    type: Sequelize.STRING,
    allowNull: false,
    set(val) {
      this.setDataValue('title', val.toUpperCase());
    }
  }
});

Employee
  .create({ name: 'John Doe', title: 'senior engineer' })
  .then(employee => {
    console.log(employee.get('name')); // John Doe (SENIOR ENGINEER)
    console.log(employee.get('title')); // SENIOR ENGINEER
  })
```

### Defining as part of the model options

Below is an example of defining the getters and setters in the model options.

The `fullName` getter, is an example of how you can define pseudo properties on your models - attributes which are not actually part of your database schema. In fact, pseudo properties can be defined in two ways: using model getters, or by using a column with the [`VIRTUAL` datatype](/variable/index.html#static-variable-DataTypes). Virtual datatypes can have validations, while getters for virtual attributes cannot.

Note that the `this.firstname` and `this.lastname` references in the `fullName` getter function will trigger a call to the respective getter functions. If you do not want that then use the `getDataValue()` method to access the raw value (see below).

```js
const Foo = sequelize.define('foo', {
  firstname: Sequelize.STRING,
  lastname: Sequelize.STRING
}, {
  getterMethods: {
    fullName() {
      return this.firstname + ' ' + this.lastname;
    }
  },

  setterMethods: {
    fullName(value) {
      const names = value.split(' ');

      this.setDataValue('firstname', names.slice(0, -1).join(' '));
      this.setDataValue('lastname', names.slice(-1).join(' '));
    }
  }
});
```

### Helper functions for use inside getter and setter definitions

* retrieving an underlying property value - always use `this.getDataValue()`

```js
/* a getter for 'title' property */
get() {
  return this.getDataValue('title')
}
```

* setting an underlying property value - always use `this.setDataValue()`

```js
/* a setter for 'title' property */
set(title) {
  this.setDataValue('title', title.toString().toLowerCase());
}
```

**N.B:** It is important to stick to using the `setDataValue()` and `getDataValue()` functions (as opposed to accessing the underlying "data values" property directly) - doing so protects your custom getters and setters from changes in the underlying model implementations.

## Validations

Model validations allow you to specify format/content/inheritance validations for each attribute of the model.

Validations are automatically run on `create`, `update` and `save`. You can also call `validate()` to manually validate an instance.

### Per-attribute validations

You can define your custom validators or use several built-in validators, implemented by [validator.js][3], as shown below.

```js
const ValidateMe = sequelize.define('foo', {
  bar: {
    type: Sequelize.STRING,
    validate: {
      is: ["^[a-z]+$",'i'],     // will only allow letters
      is: /^[a-z]+$/i,          // same as the previous example using real RegExp
      not: ["[a-z]",'i'],       // will not allow letters
      isEmail: true,            // checks for email format (foo@bar.com)
      isUrl: true,              // checks for url format (http://foo.com)
      isIP: true,               // checks for IPv4 (129.89.23.1) or IPv6 format
      isIPv4: true,             // checks for IPv4 (129.89.23.1)
      isIPv6: true,             // checks for IPv6 format
      isAlpha: true,            // will only allow letters
      isAlphanumeric: true,     // will only allow alphanumeric characters, so "_abc" will fail
      isNumeric: true,          // will only allow numbers
      isInt: true,              // checks for valid integers
      isFloat: true,            // checks for valid floating point numbers
      isDecimal: true,          // checks for any numbers
      isLowercase: true,        // checks for lowercase
      isUppercase: true,        // checks for uppercase
      notNull: true,            // won't allow null
      isNull: true,             // only allows null
      notEmpty: true,           // don't allow empty strings
      equals: 'specific value', // only allow a specific value
      contains: 'foo',          // force specific substrings
      notIn: [['foo', 'bar']],  // check the value is not one of these
      isIn: [['foo', 'bar']],   // check the value is one of these
      notContains: 'bar',       // don't allow specific substrings
      len: [2,10],              // only allow values with length between 2 and 10
      isUUID: 4,                // only allow uuids
      isDate: true,             // only allow date strings
      isAfter: "2011-11-05",    // only allow date strings after a specific date
      isBefore: "2011-11-05",   // only allow date strings before a specific date
      max: 23,                  // only allow values <= 23
      min: 23,                  // only allow values >= 23
      isCreditCard: true,       // check for valid credit card numbers

      // Examples of custom validators:
      isEven(value) {
        if (parseInt(value) % 2 !== 0) {
          throw new Error('Only even values are allowed!');
        }
      }
      isGreaterThanOtherField(value) {
        if (parseInt(value) <= parseInt(this.otherField)) {
          throw new Error('Bar must be greater than otherField.');
        }
      }
    }
  }
});
```

Note that where multiple arguments need to be passed to the built-in validation functions, the arguments to be passed must be in an array. But if a single array argument is to be passed, for instance an array of acceptable strings for `isIn`, this will be interpreted as multiple string arguments instead of one array argument. To work around this pass a single-length array of arguments, such as `[['one', 'two']]` as shown above.

To use a custom error message instead of that provided by [validator.js][3], use an object instead of the plain value or array of arguments, for example a validator which needs no argument can be given a custom message with

```js
isInt: {
  msg: "Must be an integer number of pennies"
}
```

or if arguments need to also be passed add an `args` property:

```js
isIn: {
  args: [['en', 'zh']],
  msg: "Must be English or Chinese"
}
```

When using custom validator functions the error message will be whatever message the thrown `Error` object holds.

See [the validator.js project][3] for more details on the built in validation methods.

**Hint:** You can also define a custom function for the logging part. Just pass a function. The first parameter will be the string that is logged.

### Per-attribute validators and `allowNull`

If a particular field of a model is set to not allow null (with `allowNull: false`) and that value has been set to `null`, all validators will be skipped and a `ValidationError` will be thrown.

On the other hand, if it is set to allow null (with `allowNull: true`) and that value has been set to `null`, only the built-in validators will be skipped, while the custom validators will still run.

This means you can, for instance, have a string field which validates its length to be between 5 and 10 characters, but which also allows `null` (since the length validator will be skipped automatically when the value is `null`):

```js
const User = sequelize.define('user', {
  username: {
    type: Sequelize.STRING,
    allowNull: true,
    validate: {
      len: [5, 10]
    }
  }
});
```

You also can conditionally allow `null` values, with a custom validator, since it won't be skipped:

```js
const User = sequelize.define('user', {
  age: Sequelize.INTEGER,
  name: {
    type: Sequelize.STRING,
    allowNull: true,
    validate: {
      customValidator: function(value) {
        if (value === null && this.age !== 10) {
          throw new Error("name can't be null unless age is 10");
        }
      })
    }
  }
});
```

You can customize `allowNull` error message by setting the `notNull` validator:

```js
const User = sequelize.define('user', {
  name: {
    type: Sequelize.STRING,
    allowNull: false,
    validate: {
      notNull: {
        msg: 'Please enter your name'
      }
    }
  }
});
```

### Model-wide validations

Validations can also be defined to check the model after the field-specific validators. Using this you could, for example, ensure either neither of `latitude` and `longitude` are set or both, and fail if one but not the other is set.

Model validator methods are called with the model object's context and are deemed to fail if they throw an error, otherwise pass. This is just the same as with custom field-specific validators.

Any error messages collected are put in the validation result object alongside the field validation errors, with keys named after the failed validation method's key in the `validate` option object. Even though there can only be one error message for each model validation method at any one time, it is presented as a single string error in an array, to maximize consistency with the field errors.

An example:

```js
const Pub = Sequelize.define('pub', {
  name: { type: Sequelize.STRING },
  address: { type: Sequelize.STRING },
  latitude: {
    type: Sequelize.INTEGER,
    allowNull: true,
    defaultValue: null,
    validate: { min: -90, max: 90 }
  },
  longitude: {
    type: Sequelize.INTEGER,
    allowNull: true,
    defaultValue: null,
    validate: { min: -180, max: 180 }
  },
}, {
  validate: {
    bothCoordsOrNone() {
      if ((this.latitude === null) !== (this.longitude === null)) {
        throw new Error('Require either both latitude and longitude or neither')
      }
    }
  }
})
```

In this simple case an object fails validation if either latitude or longitude is given, but not both. If we try to build one with an out-of-range latitude and no longitude, `raging_bullock_arms.validate()` might return

```js
{
  'latitude': ['Invalid number: latitude'],
  'bothCoordsOrNone': ['Require either both latitude and longitude or neither']
}
```

Such validation could have also been done with a custom validator defined on a single attribute (such as the `latitude` attribute, by checking `(value === null) !== (this.longitude === null)`), but the model-wide validation approach is cleaner.

## Configuration

You can also influence the way Sequelize handles your column names:

```js
const Bar = sequelize.define('bar', { /* bla */ }, {
  // don't add the timestamp attributes (updatedAt, createdAt)
  timestamps: false,

  // don't delete database entries but set the newly added attribute deletedAt
  // to the current date (when deletion was done). paranoid will only work if
  // timestamps are enabled
  paranoid: true,

  // Will automatically set field option for all attributes to snake cased name.
  // Does not override attribute with field option already defined
  underscored: true,

  // disable the modification of table names; By default, sequelize will automatically
  // transform all passed model names (first parameter of define) into plural.
  // if you don't want that, set the following
  freezeTableName: true,

  // define the table's name
  tableName: 'my_very_custom_table_name',

  // Enable optimistic locking.  When enabled, sequelize will add a version count attribute
  // to the model and throw an OptimisticLockingError error when stale instances are saved.
  // Set to true or a string with the attribute name you want to use to enable.
  version: true
})
```

If you want sequelize to handle timestamps, but only want some of them, or want your timestamps to be called something else, you can override each column individually:

```js
const Foo = sequelize.define('foo',  { /* bla */ }, {
  // don't forget to enable timestamps!
  timestamps: true,

  // I don't want createdAt
  createdAt: false,

  // I want updatedAt to actually be called updateTimestamp
  updatedAt: 'updateTimestamp',

  // And deletedAt to be called destroyTime (remember to enable paranoid for this to work)
  deletedAt: 'destroyTime',
  paranoid: true
})
```

You can also change the database engine, e.g. to MyISAM. InnoDB is the default.

```js
const Person = sequelize.define('person', { /* attributes */ }, {
  engine: 'MYISAM'
})

// or globally
const sequelize = new Sequelize(db, user, pw, {
  define: { engine: 'MYISAM' }
})
```

Finally you can specify a comment for the table in MySQL and PG

```js
const Person = sequelize.define('person', { /* attributes */ }, {
  comment: "I'm a table comment!"
})
```

## Import

You can also store your model definitions in a single file using the `import` method. The returned object is exactly the same as defined in the imported file's function. Since `v1:5.0` of Sequelize the import is cached, so you won't run into troubles when calling the import of a file twice or more often.

```js
// in your server file - e.g. app.js
const Project = sequelize.import(__dirname + "/path/to/models/project")

// The model definition is done in /path/to/models/project.js
// As you might notice, the DataTypes are the very same as explained above
module.exports = (sequelize, DataTypes) => {
  return sequelize.define("project", {
    name: DataTypes.STRING,
    description: DataTypes.TEXT
  })
}
```

The `import` method can also accept a callback as an argument.

```js
sequelize.import('project', (sequelize, DataTypes) => {
  return sequelize.define("project", {
    name: DataTypes.STRING,
    description: DataTypes.TEXT
  })
})
```

This extra capability is useful when, for example, `Error: Cannot find module` is thrown even though `/path/to/models/project` seems to be correct.  Some frameworks, such as Meteor, overload `require`, and spit out "surprise" results like :

```
Error: Cannot find module '/home/you/meteorApp/.meteor/local/build/programs/server/app/path/to/models/project.js'
```

This is solved by passing in Meteor's version of `require`. So, while this probably fails ...

```js
const AuthorModel = db.import('./path/to/models/project');
```
... this should succeed ...

```js
const AuthorModel = db.import('project', require('./path/to/models/project'));
```



## Optimistic Locking

Sequelize has built-in support for optimistic locking through a model instance version count.
Optimistic locking is disabled by default and can be enabled by setting the `version` property to true in a specific model definition or global model configuration.  See [model configuration][0] for more details.

Optimistic locking allows concurrent access to model records for edits and prevents conflicts from overwriting data.  It does this by checking whether another process has made changes to a record since it was read and throws an OptimisticLockError when a conflict is detected.

## Database synchronization

When starting a new project you won't have a database structure and using Sequelize you won't need to. Just specify your model structures and let the library do the rest. Currently supported is the creation and deletion of tables:

```js
// Create the tables:
Project.sync()
Task.sync()

// Force the creation!
Project.sync({force: true}) // this will drop the table first and re-create it afterwards

// drop the tables:
Project.drop()
Task.drop()

// event handling:
Project.[sync|drop]().then(() => {
  // ok ... everything is nice!
}).catch(error => {
  // oooh, did you enter wrong database credentials?
})
```

Because synchronizing and dropping all of your tables might be a lot of lines to write, you can also let Sequelize do the work for you:

```js
// Sync all models that aren't already in the database
sequelize.sync()

// Force sync all models
sequelize.sync({force: true})

// Drop all tables
sequelize.drop()

// emit handling:
sequelize.[sync|drop]().then(() => {
  // woot woot
}).catch(error => {
  // whooops
})
```

Because `.sync({ force: true })` is destructive operation, you can use `match` option as an additional safety check.
`match` option tells sequelize to match a regex against the database name before syncing - a safety check for cases
where `force: true` is used in tests but not live code.

```js
// This will run .sync() only if database name ends with '_test'
sequelize.sync({ force: true, match: /_test$/ });
```

## Expansion of models

Sequelize Models are ES6 classes. You can very easily add custom instance or class level methods.

```js
const User = sequelize.define('user', { firstname: Sequelize.STRING });

// Adding a class level method
User.classLevelMethod = function() {
  return 'foo';
};

// Adding an instance level method
User.prototype.instanceLevelMethod = function() {
  return 'bar';
};
```

Of course you can also access the instance's data and generate virtual getters:

```js
const User = sequelize.define('user', { firstname: Sequelize.STRING, lastname: Sequelize.STRING });

User.prototype.getFullname = function() {
  return [this.firstname, this.lastname].join(' ');
};

// Example:
User.build({ firstname: 'foo', lastname: 'bar' }).getFullname() // 'foo bar'
```

### Indexes
Sequelize supports adding indexes to the model definition which will be created during `Model.sync()` or `sequelize.sync`.

```js
sequelize.define('user', {}, {
  indexes: [
    // Create a unique index on email
    {
      unique: true,
      fields: ['email']
    },

    // Creates a gin index on data with the jsonb_path_ops operator
    {
      fields: ['data'],
      using: 'gin',
      operator: 'jsonb_path_ops'
    },

    // By default index name will be [table]_[fields]
    // Creates a multi column partial index
    {
      name: 'public_by_author',
      fields: ['author', 'status'],
      where: {
        status: 'public'
      }
    },

    // A BTREE index with a ordered field
    {
      name: 'title_index',
      method: 'BTREE',
      fields: ['author', {attribute: 'title', collate: 'en_US', order: 'DESC', length: 5}]
    }
  ]
})
```


[0]: /manual/tutorial/models-definition.html#configuration
[1]: /manual/tutorial/data-types.html
[3]: https://github.com/chriso/validator.js
[5]: /docs/final/misc#asynchronicity
