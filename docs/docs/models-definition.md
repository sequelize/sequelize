## Definition

To define mappings between a model and a table, use the `define` method. Sequelize will then automatically add the attributes `createdAt` and `updatedAt` to it. So you will be able to know when the database entry went into the db and when it was updated the last time. If you do not want timestamps on your models, only want some timestamps, or you are working with an existing database where the columns are named something else, jump straight on to [configuration ][0]to see how to do that.


```js
var Project = sequelize.define('Project', {
  title: Sequelize.STRING,
  description: Sequelize.TEXT
})

var Task = sequelize.define('Task', {
  title: Sequelize.STRING,
  description: Sequelize.TEXT,
  deadline: Sequelize.DATE
})
```

You can also set some options on each column:

```js
var Foo = sequelize.define('Foo', {
 // instantiating will automatically set the flag to true if not set
 flag: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true},

 // default values for dates => current time
 myDate: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },

 // setting allowNull to false will add NOT NULL to the column, which means an error will be
 // thrown from the DB when the query is executed if the column is null. If you want to check that a value
 // is not null before querying the DB, look at the validations section below.
 title: { type: Sequelize.STRING, allowNull: false},

 // Creating two objects with the same value will throw an error. The unique property can be either a
 // boolean, or a string. If you provide the same string for multiple columns, they will form a
 // composite unique key.
 someUnique: {type: Sequelize.STRING, unique: true},
 uniqueOne: { type: Sequelize.STRING,  unique: 'compositeIndex'},
 uniqueTwo: { type: Sequelize.INTEGER, unique: 'compositeIndex'}
 
 // The unique property is simply a shorthand to create a unique index.
 someUnique: {type: Sequelize.STRING, unique: true}
 // It's exactly the same as creating the index in the model's options.
 {someUnique: {type: Sequelize.STRING}},
 {indexes: [{unique: true, fields: ['someUnique']}]}

 // Go on reading for further information about primary keys
 identifier: { type: Sequelize.STRING, primaryKey: true},

 // autoIncrement can be used to create auto_incrementing integer columns
 incrementMe: { type: Sequelize.INTEGER, autoIncrement: true },

 // Comments can be specified for each field for MySQL and PG
 hasComment: { type: Sequelize.INTEGER, comment: "I'm a comment!" },

 // You can specify a custom field name via the "field" attribute:
 fieldWithUnderscores: { type: Sequelize.STRING, field: "field_with_underscores" },

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
 }
})
```

The comment option can also be used on a table, see [model configuration][0]

## Data types

Below are some of the datatypes supported by sequelize. For a full and updated list, see [DataTypes](../api/datatypes).

```js
Sequelize.STRING                      // VARCHAR(255)
Sequelize.STRING(1234)                // VARCHAR(1234)
Sequelize.STRING.BINARY               // VARCHAR BINARY
Sequelize.TEXT                        // TEXT

Sequelize.INTEGER                     // INTEGER
Sequelize.BIGINT                      // BIGINT
Sequelize.BIGINT(11)                  // BIGINT(11)

Sequelize.FLOAT                       // FLOAT
Sequelize.FLOAT(11)                   // FLOAT(11)
Sequelize.FLOAT(11, 12)               // FLOAT(11,12)

Sequelize.REAL                        // REAL        PostgreSQL only.
Sequelize.REAL(11)                    // REAL(11)    PostgreSQL only.
Sequelize.REAL(11, 12)                // REAL(11,12) PostgreSQL only.

Sequelize.DOUBLE                      // DOUBLE
Sequelize.DOUBLE(11)                  // DOUBLE(11)
Sequelize.DOUBLE(11, 12)              // DOUBLE(11,12)

Sequelize.DECIMAL                     // DECIMAL
Sequelize.DECIMAL(10, 2)              // DECIMAL(10,2)

Sequelize.DATE                        // DATETIME for mysql / sqlite, TIMESTAMP WITH TIME ZONE for postgres
Sequelize.BOOLEAN                     // TINYINT(1)

Sequelize.ENUM('value 1', 'value 2')  // An ENUM with allowed values 'value 1' and 'value 2'
Sequelize.ARRAY(Sequelize.TEXT)       // Defines an array. PostgreSQL only.

Sequelize.JSON                        // JSON column. PostgreSQL only.
Sequelize.JSONB                       // JSONB column. PostgreSQL only.

Sequelize.BLOB                        // BLOB (bytea for PostgreSQL)
Sequelize.BLOB('tiny')                // TINYBLOB (bytea for PostgreSQL. Other options are medium and long)

Sequelize.UUID                        // UUID datatype for PostgreSQL and SQLite, CHAR(36) BINARY for MySQL (use defaultValue: Sequelize.UUIDV1 or Sequelize.UUIDV4 to make sequelize generate the ids automatically)
```

The BLOB data type allows you to insert data both as strings and as buffers. When you do a find or findAll on a model which has a BLOB column. that data will always be returned as a buffer.

If you are working with the PostgreSQL TIMESTAMP WITHOUT TIME ZONE and you need to parse it to a different timezone, please use the pg library's own parser:

```js
require('pg').types.setTypeParser(1114, function(stringValue) {
  return new Date(stringValue + "+0000");
  // e.g., UTC offset. Use any offset that you would like.
});
```

In addition to the type mentioned above, integer, bigint, float and double also support unsigned and zerofill properties, which can be combined in any order:
Be aware that this does not apply for PostgreSQL!

```js
Sequelize.INTEGER.UNSIGNED              // INTEGER UNSIGNED
Sequelize.INTEGER(11).UNSIGNED          // INTEGER(11) UNSIGNED
Sequelize.INTEGER(11).ZEROFILL          // INTEGER(11) ZEROFILL
Sequelize.INTEGER(11).ZEROFILL.UNSIGNED // INTEGER(11) UNSIGNED ZEROFILL
Sequelize.INTEGER(11).UNSIGNED.ZEROFILL // INTEGER(11) UNSIGNED ZEROFILL
```

_The examples above only show integer&comma; but the same can be done with bigint and float_

Usage in object notation:

```js
// for enums:
sequelize.define('model', {
  states: {
    type:   Sequelize.ENUM,
    values: ['active', 'pending', 'deleted']
  }
})
```

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
the rule in a transaction. See [the transaction section](transactions/#options) for further information.

## Getters & setters

It is possible to define 'object-property' getters and setter functions on your models, these can be used both for 'protecting' properties that map to database fields and for defining 'pseudo' properties.

Getters and Setters can be defined in 2 ways (you can mix and match these 2 approaches):

* as part of a single property definition
* as part of a model options

**N.B:** If a getter or setter is defined in both places then the function found in the relevant property definition will always take precedence.

### Defining as part of a property

```js
var Employee = sequelize.define('Employee', {
  name:  {
    type     : Sequelize.STRING,
    allowNull: false,
    get      : function()  {
      var title = this.getDataValue('title');
      // 'this' allows you to access attributes of the instance
      return this.getDataValue('name') + ' (' + title + ')';
    },
  },
  title: {
    type     : Sequelize.STRING,
    allowNull: false,
    set      : function(val) {
      this.setDataValue('title', val.toUpperCase());
    }
  }
});

Employee
  .create({ name: 'John Doe', title: 'senior engineer' })
  .then(function(employee) {
    console.log(employee.get('name')); // John Doe (SENIOR ENGINEER)
    console.log(employee.get('title')); // SENIOR ENGINEER
  })
```

### Defining as part of the model options

Below is an example of defining the getters and setters in the model options. The `fullName` getter,  is an example of how you can define pseudo properties on your models - attributes which are not actually part of your database schema. In fact, pseudo properties can be defined in two ways: using model getters, or by using a column with the [`VIRTUAL` datatype](../api/datatypes#virtual). Virtual datatypes can have validations, while getters for virtual attributes cannot.

Note that the `this.firstname` and `this.lastname` references in the `fullName` getter function will trigger a call to the respective getter functions. If you do not want that then use the `getDataValue()` method to access the raw value (see below).

```js
var Foo = sequelize.define('Foo', {
  firstname: Sequelize.STRING,
  lastname: Sequelize.STRING
}, {
  getterMethods   : {
    fullName       : function()  { return this.firstname + ' ' + this.lastname }
  },

  setterMethods   : {
    fullName       : function(value) {
        var names = value.split(' ');

        this.setDataValue('firstname', names.slice(0, -1).join(' '));
        this.setDataValue('lastname', names.slice(-1).join(' '));
    },
  }
});
```

### Helper functions for use inside getter and setter definitions

* retrieving an underlying property value - always use `this.getDataValue()`

```js
/* a getter for 'title' property */
function() {
    return this.getDataValue('title');
}
```

* setting an underlying property value - always use `this.setDataValue()`

```js
/* a setter for 'title' property */
function(title) {
    return this.setDataValue('title', title.toString().toLowerCase());
}
```

**N.B:** It is important to stick to using the `setDataValue()` and `getDataValue()` functions (as opposed to accessing the underlying "data values" property directly) - doing so protects your custom getters and setters from changes in the underlying model implementations.

## Validations

Model validations, allow you to specify format&sol;content&sol;inheritance validations for each attribute of the model&period;

Validations are automatically run on `create`, `update` and `save`. You can also call `validate()` to manually validate an instance.

The validations are implemented by [validator.js][3].

```js
var ValidateMe = sequelize.define('Foo', {
  foo: {
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
      isAlphanumeric: true      // will only allow alphanumeric characters, so "_abc" will fail
      isNumeric: true           // will only allow numbers
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
      max: 23,                  // only allow values
      min: 23,                  // only allow values >= 23
      isArray: true,            // only allow arrays
      isCreditCard: true,       // check for valid credit card numbers

      // custom validations are also possible:
      isEven: function(value) {
        if(parseInt(value) % 2 != 0) {
          throw new Error('Only even values are allowed!')
        // we also are in the model's context here, so this.otherField
        // would get the value of otherField if it existed
        }
      }
    }
  }
})
```

Note that where multiple arguments need to be passed to the built-in validation functions&comma; the arguments to be passed must be in an array&period; But if a single array argument is to be passed&comma; for instance an array of acceptable strings for `isIn`, this will be interpreted as multiple string arguments instead of one array argument&period; To work around this pass a single-length array of arguments&comma; such as `[['one', 'two']]` as shown above&period;

To use a custom error message instead of that provided by validator.js&comma; use an object instead of the plain value or array of arguments&comma; for example a validator which needs no argument can be given a custom message with

```js
isInt: {
  msg: "Must be an integer number of pennies"
}
```

or if arguments need to also be passed add an`args`property&colon;

```js
isIn: {
  args: [['en', 'zh']],
  msg: "Must be English or Chinese"
}
```

When using custom validator functions the error message will be whatever message the thrown`Error`object holds&period;

See [the validator.js project][3] for more details on the built in validation methods&period;

**Hint&colon; **You can also define a custom function for the logging part&period; Just pass a function&period; The first parameter will be the string that is logged&period;

### Validators and `allowNull`

If a particular field of a model is set to allow null &lpar;with `allowNull: true`&rpar; and that value has been set to `null` &comma; its validators do not run&period; This means you can&comma; for instance&comma; have a string field which validates its length to be at least 5 characters&comma; but which also allows`null`&period;

### Model validations

Validations can also be defined to check the model after the field-specific validators&period; Using this you could&comma; for example&comma; ensure either neither of `latitude` and `longitude` are set or both&comma; and fail if one but not the other is set&period;

Model validator methods are called with the model object's context and are deemed to fail if they throw an error&comma; otherwise pass&period; This is just the same as with custom field-specific validators&period;

Any error messages collected are put in the validation result object alongside the field validation errors&comma; with keys named after the failed validation method's key in the `validate` option object&period; Even though there can only be one error message for each model validation method at any one time&comma; it is presented as a single string error in an array&comma; to maximize consistency with the field errors&period;

An example&colon;

```js
var Pub = Sequelize.define('Pub', {
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
    bothCoordsOrNone: function() {
      if ((this.latitude === null) !== (this.longitude === null)) {
        throw new Error('Require either both latitude and longitude or neither')
      }
    }
  }
})
```

In this simple case an object fails validation if either latitude or longitude is given&comma; but not both&period; If we try to build one with an out-of-range latitude and nolongitude, `raging_bullock_arms.validate()` might return

```js
{
  'latitude': ['Invalid number: latitude'],
  'bothCoordsOrNone': ['Require either both latitude and longitude or neither']
}
```

## Configuration

You can also influence the way Sequelize handles your column names&colon;

```js
var Bar = sequelize.define('Bar', { /* bla */ }, {
  // don't add the timestamp attributes (updatedAt, createdAt)
  timestamps: false,

  // don't delete database entries but set the newly added attribute deletedAt
  // to the current date (when deletion was done). paranoid will only work if
  // timestamps are enabled
  paranoid: true,

  // don't use camelcase for automatically added attributes but underscore style
  // so updatedAt will be updated_at
  underscored: true,

  // disable the modification of tablenames; By default, sequelize will automatically
  // transform all passed model names (first parameter of define) into plural.
  // if you don't want that, set the following
  freezeTableName: true,

  // define the table's name
  tableName: 'my_very_custom_table_name'
})
```

If you want sequelize to handle timestamps, but only want some of them, or want your timestamps to be called something else, you can override each column individually:

```js
var Foo = sequelize.define('Foo',  { /* bla */ }, {
  // don't forget to enable timestamps!
  timestamps: true,

  // I don't want createdAt
  createdAt: false,

  // I want updatedAt to actually be called updateTimestamp
  updatedAt: 'updateTimestamp'

  // And deletedAt to be called destroyTime (remember to enable paranoid for this to work)
  deletedAt: 'destroyTime',
  paranoid: true
})
```

You can also change the database engine&comma; e&period;g&period; to MyISAM&period; InnoDB is the default.

```js
var Person = sequelize.define('Person', { /* attributes */ }, {
  engine: 'MYISAM'
})

// or globally
var sequelize = new Sequelize(db, user, pw, {
  define: { engine: 'MYISAM' }
})
```

Finaly you can specify a comment for the table in MySQL and PG

```js
var Person = sequelize.define('Person', { /* attributes */ }, {
  comment: "I'm a table comment!"
})
```

## Import

You can also store your model definitions in a single file using the `import` method&period; The returned object is exactly the same as defined in the imported file's function&period; Since `v1:5.0` of Sequelize the import is cached&comma; so you won't run into troubles when calling the import of a file twice or more often&period;

```js
// in your server file - e.g. app.js
var Project = sequelize.import(__dirname + "/path/to/models/project")

// The model definition is done in /path/to/models/project.js
// As you might notice, the DataTypes are the very same as explained above
module.exports = function(sequelize, DataTypes) {
  return sequelize.define("Project", {
    name: DataTypes.STRING,
    description: DataTypes.TEXT
  })
}
```

The `import` method can also accept a callback as an argument&period;

```js
sequelize.import('Project', function(sequelize, DataTypes) {
  return sequelize.define("Project", {
    name: DataTypes.STRING,
    description: DataTypes.TEXT
  })
})
```

## Database synchronization

When starting a new project you won't have a database structure and using Sequelize you won't need to&period; Just specify your model structures and let the library do the rest&period; Currently supported is the creation and deletion of tables&colon;

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
Project.[sync|drop]().then(function() {
  // ok ... everything is nice!
}).catch(function(error) {
  // oooh, did you enter wrong database credentials?
})
```

Because synchronizing and dropping all of your tables might be a lot of lines to write&comma; you can also let Sequelize do the work for you&colon;

```js
// Sync all models that aren't already in the database
sequelize.sync()

// Force sync all modes
sequelize.sync({force: true})

// Drop all tables
sequelize.drop()

// emit handling:
sequelize.[sync|drop]().then(function() {
  // woot woot
}).catch(function(error) {
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

Sequelize allows you to pass custom methods to a model and its instances&period; Just do the following&colon;

```js
var Foo = sequelize.define('Foo', { /* attributes */}, {
  classMethods: {
    method1: function(){ return 'smth' }
  },
  instanceMethods: {
    method2: function() { return 'foo' }
  }
})

// Example:
Foo.method1()
Foo.build().method2()
```

Of course you can also access the instance's data and generate virtual getters&colon;

```js
var User = sequelize.define('User', { firstname: Sequelize.STRING, lastname: Sequelize.STRING }, {
  instanceMethods: {
    getFullname: function() {
      return [this.firstname, this.lastname].join(' ')
    }
  }
})

// Example:
User.build({ firstname: 'foo', lastname: 'bar' }).getFullname() // 'foo bar'
```

You can also set custom methods to all of your models during the instantiation&colon;

```js
var sequelize = new Sequelize('database', 'username', 'password', {
  // Other options during the initialization could be here
  define: {
    classMethods: {
      method1: function() {},
      method2: function() {}
    },
    instanceMethods: {
      method3: function() {}
    }
  }
})

// Example:
var Foo = sequelize.define('Foo', { /* attributes */});
Foo.method1()
Foo.method2()
Foo.build().method3()
```

### Indexes
Sequelize supports adding indexes to the model definition which will be created during `Model.sync()` or `sequelize.sync`.

```js
sequelize.define('User', {}, {
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


[0]: #configuration
[3]: https://github.com/chriso/validator.js
[5]: /docs/latest/misc#asynchronicity
[6]: https://github.com/petkaantonov/bluebird/blob/master/API.md#spreadfunction-fulfilledhandler--function-rejectedhandler----promise
