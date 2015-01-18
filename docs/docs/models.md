## Definition

To define mappings between a model and a table&comma; use the `define` method&period; Sequelize will then automatically add the attributes `createdAt` and `updatedAt` to it&period; So you will be able to know when the database entry went into the db and when it was updated the last time&period; If you do not want timestamps on your models, only want some timestamps, or you are working with an existing database where the columns are named something else, jump straight on to [configuration ][0]to see how to do that.
    
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

 // Go on reading for further information about primary keys
 identifier: { type: Sequelize.STRING, primaryKey: true},

 // autoIncrement can be used to create auto_incrementing integer columns
 incrementMe: { type: Sequelize.INTEGER, autoIncrement: true },

 // Comments can be specified for each field for MySQL and PG
 hasComment: { type: Sequelize.INTEGER, comment: "I'm a comment!" },

 // You can specify a custom field name via the "field" attribute:
 fieldWithUnderscores: { type: Sequelize.STRING, field: "field_with_underscores" }
})
```

The comment option can also be used on a table, see [model configuration][0]

## Data types

Sequelize currently supports the following datatypes:

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
 
Sequelize.DECIMAL                     // DECIMAL
Sequelize.DECIMAL(10, 2)              // DECIMAL(10,2)
 
Sequelize.DATE                        // DATETIME for mysql / sqlite, TIMESTAMP WITH TIME ZONE for postgres
Sequelize.BOOLEAN                     // TINYINT(1)
 
Sequelize.ENUM('value 1', 'value 2')  // An ENUM with allowed values 'value 1' and 'value 2'
Sequelize.ARRAY(Sequelize.TEXT)       // Defines an array. PostgreSQL only.
 
Sequelize.BLOB                        // BLOB (bytea for PostgreSQL)
Sequelize.BLOB('tiny')                // TINYBLOB (bytea for PostgreSQL. Other options are medium and long)
Sequelize.UUID                        // UUID datatype for PostgreSQL and SQLite, CHAR(36) BINARY for MySQL (use defaultValue: Sequelize.UUIDV1 or Sequelize.UUIDV4 to make sequelize generate the ids automatically)
```

The BLOB data type allows you to insert data both as strings and as buffers&period; When you do a find or findAll on a model which has a BLOB column&comma; that data will always be returned as a buffer&period;
 
If you are working with the PostgreSQL TIMESTAMP WITHOUT TIME ZONE and you need to parse it to a different timezone&comma; please use the pg library's own parser&colon;

```js
require('pg').types.setTypeParser(1114, function(stringValue) {
  return new Date(stringValue + "+0000"); 
  // e.g., UTC offset. Use any offset that you would like.
});
```

In addition to the type mentioned above&comma; integer&comma; bigint and float also support unsigned and zerofill properties&comma; which can be combined in any order&colon;

```js
Sequelize.INTEGER.UNSIGNED              // INTEGER UNSIGNED
Sequelize.INTEGER(11).UNSIGNED          // INTEGER(11) UNSIGNED
Sequelize.INTEGER(11).ZEROFILL          // INTEGER(11) ZEROFILL
Sequelize.INTEGER(11).ZEROFILL.UNSIGNED // INTEGER(11) UNSIGNED ZEROFILL
Sequelize.INTEGER(11).UNSIGNED.ZEROFILL // INTEGER(11) UNSIGNED ZEROFILL
```

_The examples above only show integer&comma; but the same can be done with bigint and float_

Usage in object notation&colon;
    
```js
// for enums:
sequelize.define('model', {
  states: {
    type:   Sequelize.ENUM,
    values: ['active', 'pending', 'deleted']
  }
})
```

## Getters & setters

It is possible to define 'object-property' getters and setter functions on your models&comma; these can be used both for 'protecting' properties that map to database fields and for defining 'pseudo' properties&period;

Getters and Setters can be defined in 2 ways &lpar;you can mix and match these 2 approaches&excl;&rpar;&colon;

* as part of a single property definition
* as part of a model options

**N&period;B&period;&colon;**If a getter or setter is defined in both places then the function found in the relevant property definition will always take precedence&period;

### Defining as part of a property
 
```js   
var Foo = sequelize.define('Foo', {
  name: Sequelize.STRING,
  title: {
    type     : Sequelize.STRING,
    allowNull: false,
    get      : function()  {
       /*
         do your magic here and return something!
         'this' allows you to access attributes of the model.
 
        example: this.getDataValue('name') works
      */
    },
    set      : function(v) { /* do your magic with the input here! */ }
  }
});
```

### Defining as part of the model options

Below is an example of defining the getters and setters in the model options&comma; notice the `title_slugslug` getter&comma; it shows how you can define `pseudo` properties on your models&excl; &lpar;the `slugify()` function was taken from the [Underscore&period;String module][1]&comma; it is slightly modified here so that the example remains self-contained&rpar;&comma; note that the `this.title` reference in the `title_slug` getter function will trigger a call to the `title` getter function&period; if you do not want that then use the `getDataValue()` method &lpar;[see below][2]&rpar;&period;
    
```js
var defaultToWhiteSpace = function(characters) {
    if (characters == null)
      return '\\s';
    else if (characters.source)
      return characters.source;
    else
      return ;
  };
 
var slugify = function(str) {
  var from  = "ąàáäâãåæćęèéëêìíïîłńòóöôõøśùúüûñçżź",
      to    = "aaaaaaaaceeeeeiiiilnoooooosuuuunczz",
      regex = new RegExp('[' + from.replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1') + ']', 'g');
 
  if (str == null) return '';
 
  str = String(str).toLowerCase().replace(regex, function(c) {
    return to.charAt(from.indexOf(c)) || '-';
  });
 
  return str.replace(/[^\w\s-]/g, '').replace(/([A-Z])/g, '-$1').replace(/[-_\s]+/g, '-').toLowerCase();
}
 
var Foo = sequelize.define('Foo', {
  title: {
    type     : Sequelize.STRING,
    allowNull: false,
  }
}, {
 
  getterMethods   : {
    title       : function()  { /* do your magic here and return something! */ },
    title_slug  : function()  { return slugify(this.title); }
  },
 
  setterMethods   : {
    title       : function(v) { /* do your magic with the input here! */ },
  }
});
```

### Helper functions for use inside getter&sol;setter definitions

* retrieving an underlying property value&quest; always use `this.getDataValue()`&comma; e&period;g&colon;
    
```js
/* a getter for 'title' property */
function() {
    return this.getDataValue('title');
}
```

* setting an underlying property value&quest; always use `this.setDataValue()`&comma; e&period;g&period;&colon;
    
```js
/* a setter for 'title' property */
function(title) {
    return this.setDataValue('title', title.toString().toLowerCase());
}
```

**N.B.: **It is important to stick to using the `setDataValue()` and `getDataValue()` functions &lpar;as opposed to accessing the underlying "data values" property directly&rpar; - doing so protects your custom getters and setters from changes in the underlying model implementations &lpar;i&period;e&period; how and where data values are stored in your model instances&rpar;

### Setter methods and Object Initialization

&excl;&excl;&excl;TODO&colon; write about how setters affect object initialization &lpar;both creating new objects with Model&period;build and retrieving existing objects from storage&rpar; &excl;&excl;&excl;&excl;&excl;

## Validations

Model validations, allow you to specify format&sol;content&sol;inheritance validations for each attribute of the model&period; You can perform the validation by calling the `validate()` method on an instance before saving&period; The validations are implemented by [validator][3].

**Note&colon; **In `v1.7.0` validations will now be called when executing the `build()` or `create()` functions.
    
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

To use a custom error message instead of that provided by node-validator&comma; use an object instead of the plain value or array of arguments&comma; for example a validator which needs no argument can be given a custom message with
    
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

See [the node-validator project][4]for more details on the built in validation methods&period;

**Hint&colon; **You can also define a custom function for the logging part&period; Just pass a function&period; The first parameter will be the string that is logged&period;

### Validators and`allowNull`

Since `v1.7.0` if a particular field of a model is set to allow null &lpar;with `allowNull: true`&rpar; and that value has been set to `null` &comma; its validators do not run&period; This means you can&comma; for instance&comma; have a string field which validates its length to be at least 5 characters&comma; but which also allows`null`&period;

### Model validations

Since `v1.7.0` &comma; validations can also be defined to check the model after the field-specific validators&period; Using this you could&comma; for example&comma; ensure either neither of `latitude` and `longitude` are set or both&comma; and fail if one but not the other is set&period;

Model validator methods are called with the model object's context and are deemed to fail if they throw an error&comma; otherwise pass&period; This is just the same as with custom field-specific validators&period;

Any error messages collected are put in the validation result object alongside the field validation errors&comma; with keys named after the failed validation method's key in the `validate` option object&period; Even though there can only be one error message for each model validation method at any one time&comma; it is presented as a single string error in an array&comma; to maximize consistency with the field errors&period; &lpar;Note that the structure of `validate()`'s output is scheduled to change in `v2.0`to avoid this awkward situation&period; In the mean time&comma; an error is issued if a field exists with the same name as a custom model validation&period;&rpar;

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
      if ((this.latitude === null) === (this.longitude === null)) {
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

Since `v1.7.0` the `import` method can now accept a callback as an argument&period;
    
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
Project.sync() // will emit success or failure event
Task.sync() // will emit success or failure event
 
// Force the creation!
Project.sync({force: true}) // this will drop the table first and re-create it afterwards
 
// drop the tables:
Project.drop() // will emit success or failure event
Task.drop() // will emit success or failure event
 
// event handling:
Project.[sync|drop]().then(function() {
  // ok ... everything is nice!
}).catch(function(error) {
  // oooh, did you entered wrong database credentials?
})
```

Because synchronizing and dropping all of your tables might be a lot of lines to write&comma; you can also let Sequelize do the work for you&colon;
    
```js
// create all tables... now!
sequelize.sync() // will emit success or failure
 
// force it!
sequelize.sync({force: true}) // emit ... nomnomnom
 
// want to drop 'em all?
sequelize.drop() // I guess you've got it (emit)
 
// emit handling:
sequelize.[sync|drop]().then(function() {
  // woot woot
}).catch(function(error) {
  // whooops
})
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

## Data retrieval / Finders

Finder methods are designed to get data from the database&period; The returned data isn't just a plain object&comma; but instances of one of the defined classes&period; Check the next major chapter about instances for further information&period; But as those things are instances&comma; you can e&period;g&period; use the just describe expanded instance methods&period; So&comma; here is what you can do&colon;

### find - Search for one specific element in the database
```js
// search for known ids
Project.find(123).then(function(project) {
  // project will be an instance of Project and stores the content of the table entry
  // with id 123. if such an entry is not defined you will get null
})
 
// search for attributes
Project.find({ where: {title: 'aProject'} }).then(function(project) {
  // project will be the first entry of the Projects table with the title 'aProject' || null
})
 
// since v1.3.0: only select some attributes and rename one
Project.find({
  where: {title: 'aProject'},
  attributes: ['id', ['name', 'title']]
}).then(function(project) {
  // project will be the first entry of the Projects table with the title 'aProject' || null
  // project.title will contain the name of the project
})
```

### findOrCreate - Search for a specific element or create it if not available

The method `findOrCreate` can be used to check if a certain element is already existing in the database&period; If that is the case the method will result in a respective instance&period; If the element does not yet exist&comma; it will be created.

Let's assume we have an empty database with a `User` model which has a `username` and a `job`.
    
```js
User
  .findOrCreate({where: {username: 'sdepold'}, defaults: {job: 'Technical Lead JavaScript'}})
  .spread(function(user, created) {
    console.log(user.values)
    console.log(created)
   
    /*
      {
        username: 'sdepold',
        job: 'Technical Lead JavaScript',
        id: 1,
        createdAt: Fri Mar 22 2013 21: 28: 34 GMT + 0100(CET),
        updatedAt: Fri Mar 22 2013 21: 28: 34 GMT + 0100(CET)
      }
      created: true
    */
  })
```

The code created a new instance&period; So when we already have an instance &period;&period;&period;
```js
User
  .create({ username: 'fnord', job: 'omnomnom' })
  .then(function() {
    User
      .findOrCreate({where: {username: 'fnord'}, defaults: {job: 'something else'}})
      .spread(function(user, created) {
        console.log(user.values)
        console.log(created)
     
        /*
          {
            username: 'fnord',
            job: 'omnomnom',
            id: 2,
            createdAt: Fri Mar 22 2013 21: 28: 34 GMT + 0100(CET),
            updatedAt: Fri Mar 22 2013 21: 28: 34 GMT + 0100(CET)
          }
          created: false
        */
      })
  })
```

&period;&period;&period; the existing entry will not be changed&period; See the `job` of the second user&comma; and the fact that created was false&period;

### findAndCountAll - Search for multiple elements in the database&comma; returns both data and total count

This is a convienience method that combines`findAll&lpar;&rpar;`and`count&lpar;&rpar;`&lpar;see below&rpar;&comma; this is useful when dealing with queries related to pagination where you want to retrieve data with a`limit`and`offset`but also need to know the total number of records that match the query&period;

The success handler will always receive an object with two properties&colon;

* `count` - an integer&comma; total number records &lpar;matching the where clause&rpar;
* `rows` - an array of objects&comma; the records &lpar;matching the where clause&rpar; within the limit&sol;offset range
```js
Project
  .findAndCountAll({
     where: {
        title: {
            like: 'foo%'
        }
     },
     offset: 10,
     limit: 2
  })
  .then(function(result) {
    console.log(result.count);
    console.log(result.rows);
  });
```

The options &lsqb;object&rsqb; that you pass to`findAndCountAll&lpar;&rpar;`is the same as for`findAll&lpar;&rpar;`&lpar;described below&rpar;&period;

### findAll - Search for multiple elements in the database
```js
// find multiple entries
Project.findAll().then(function(projects) {
  // projects will be an array of all Project instances
})
 
// also possible:
Project.all().then(function(projects) {
  // projects will be an array of all Project instances
})
 
// search for specific attributes - hash usage
Project.findAll({ where: { name: 'A Project' } }).then(function(projects) {
  // projects will be an array of Project instances with the specified name
})
 
// search with string replacements
Project.findAll({ where: ["id > ?", 25] }).then(function(projects) {
  // projects will be an array of Projects having a greater id than 25
})
 
// search within a specific range
Project.findAll({ where: { id: [1,2,3] } }).then(function(projects) {
  // projects will be an array of Projects having the id 1, 2 or 3
  // this is actually doing an IN query
})
 
// or
Project.findAll({ where: "name = 'A Project'" }).then(function(projects) {
  // the difference between this and the usage of hashes (objects) is, that string usage
  // is not sql injection safe. so make sure you know what you are doing!
})
 
// since v1.7.0 we can now improve our where searches
Project.findAll({
  where: {
    id: {
      gt: 6,              // id > 6
      gte: 6,             // id >= 6
      lt: 10,             // id < 10
      lte: 10,            // id 
      ne: 20,             // id != 20
      between: [6, 10],   // BETWEEN 6 AND 10
      nbetween: [11, 15], // NOT BETWEEN 11 AND 15
      in: [1, 2],         // IN [1, 2]
      like: '%hat',       // LIKE '%hat'
      nlike: '%hat'       // NOT LIKE '%hat'
      ilike: '%hat'       // ILIKE '%hat' (case insensitive)
      nilike: '%hat'      // NOT ILIKE '%hat'
      overlap: [1, 2]     // && [1, 2] (PG array overlap operator)
    }
  }
})
```

### Complex filtering / OR queries

Since `v1.7.0-rc3`, it is possible to do complex where queries with multiple levels of nested AND and OR conditions. In order to do that you can use `Sequelize.or` and `Sequelize.and` and pass an arbitrary amount of arguments to it. Every argument will get transformed into a proper SQL condition and gets joined with the either `AND` or `OR`.
    
```js
Project.find({
  where: Sequelize.and(
    { name: 'a project' },
    Sequelize.or(
      { id: [1,2,3] },
      { id: { lt: 10 } }
    )
  )
})
```

This code will generate the following query:

```sql
SELECT *
FROM `Projects`
WHERE (
  `Projects`.`name`='a project'
   AND (`Projects`.`id` IN (1,2,3) OR `Projects`.`id` < 10)
)
LIMIT 1
;
```

Notice, that instead of `Sequelize.and` you can also use a plain array which will be treated as `Sequelize.and` if it contains objects or hashes or other complex data types. Furthermore you can use `Sequelize.or` as value for the where clause.

### Manipulating the dataset with limit&comma; offset&comma; order and group

To get more relevant data&comma; you can use limit&comma; offset&comma; order and grouping&colon;
    
```js
// limit the results of the query
Project.findAll({ limit: 10 })
 
// step over the first 10 elements
Project.findAll({ offset: 10 })
 
// step over the first 10 elements, and take 2
Project.findAll({ offset: 10, limit: 2 })
```

The syntax for grouping and ordering are equal&comma; so below it is only explained with a single example for group&comma; and the rest for order&period; Everything you see below can also be done for group
    
```js
Project.findAll({order: 'title DESC'})
// yields ORDER BY title DESC
 
Project.findAll({group: 'name'})
// yields GROUP BY name
```

Notice how in the two examples above&comma; the string provided is inserted verbatim into the query&comma; i&period;e&period; column names are not escaped&period; When you provide a string to order &sol; group&comma; this will always be the case as per v 1&period;7&period;0&period; If you want to escape column names&comma; you should provide an array of arguments&comma; even though you only want to order &sol; group by a single column
    
```js
something.find({
  order: [
    'name',
    // will return `name`
    'username DESC',
    // will return `username DESC` -- i.e. don't do it!
    ['username', 'DESC'],
    // will return `username` DESC
    sequelize.fn('max', sequelize.col('age')),
    // will return max(`age`)
    [sequelize.fn('max', sequelize.col('age')), 'DESC'],
    // will return max(`age`) DESC
    [sequelize.fn('otherfunction', sequelize.col('col1'), 12, 'lalala'), 'DESC'],
    // will return otherfunction(`col1`, 12, 'lalala') DESC
    [sequelize.fn('otherfunction', sequelize.fn('awesomefunction', sequelize.col('col'))), 'DESC']
    // will return otherfunction(awesomefunction(`col`)) DESC, This nesting is potentially infinite!
    [{ raw: 'otherfunction(awesomefunction(`col`))' }, 'DESC']
    // This won't be quoted, but direction will be added
  ]
})
```

To recap&comma; the elements of the order &sol; group array can be the following&colon;

* String - will be quoted
* Array - first element will be qouted&comma; second will be appended verbatim
* Object -
  * Raw will be added verbatim without quoting
  * Everything else is ignored&comma; and if raw is not set&comma; the query will fail
* Sequelize&period;fn and Sequelize&period;col returns functions and quoted cools

### Raw queries

Sometimes you might be expecting a massive dataset that you just want to display&comma; without manipulation&period; For each row you select&comma; Sequelize creates a_DAO_&comma; with functions for update&comma; delete&comma; get associations etc&period; If you have thousands of rows&comma; this might take some time&period; If you only need the raw data and don't want to update anything&comma; you can do like this to get the raw data&period;
    
```js
// Are you expecting a masssive dataset from the DB, and don't want to spend the time building DAOs for each entry?
// You can pass an extra query option to get the raw data instead:
Project.findAll({ where: ... }, { raw: true })
```

### count - Count the occurences of elements in the database

There is also a method for counting database objects&colon;
    
```js
Project.count().then(function(c) {
  console.log("There are " + c + " projects!")
})
 
Project.count({ where: ["id > ?", 25] }).then(function(c) {
  console.log("There are " + c + " projects with an id greater than 25.")
})
```

### max - Get the greatest value of a specific attribute within a specific table

And here is a method for getting the max value of an attribute&colon;f
    
```js
/*
  Let's assume 3 person objects with an attribute age.
  The first one is 10 years old,
  the second one is 5 years old,
  the third one is 40 years old.
*/
Project.max('age').then(function(max) {
  // this will return 40
})
 
Project.max('age', { where: { age: { lt: 20 } } }).then(function(max) {
  // will be 10
})
```

### min - Get the least value of a specific attribute within a specific table

And here is a method for getting the min value of an attribute&colon;

```js
/*
  Let's assume 3 person objects with an attribute age.
  The first one is 10 years old,
  the second one is 5 years old,
  the third one is 40 years old.
*/
Project.min('age').then(function(min) {
  // this will return 5
})
 
Project.min('age', { where: { age: { gt: 5 } } }).then(function(min) {
  // will be 10
})
```

### sum - Sum the value of specific attributes

In order to calculate the sum over a specific column of a table, you can
use the `sum` method.
  
```js  
/*
  Let's assume 3 person objects with an attribute age.
  The first one is 10 years old,
  the second one is 5 years old,
  the third one is 40 years old.
*/
Project.sum('age').then(function(sum) {
  // this will return 55
})
 
Project.sum('age', { where: { age: { gt: 5 } } }).then(function(sum) {
  // wil be 50
})
```

## Eager loading

When you are retrieving data from the database there is a fair chance that you also want to get their associations&period; This is possible since`v1.6.0`and is called eager loading&period; The basic idea behind that&comma; is the use of the attribute`include`when you are calling`find`or`findAll`&period; Lets assume the following setup&colon;
    
```js
var User = sequelize.define('User', { name: Sequelize.STRING })
  , Task = sequelize.define('Task', { name: Sequelize.STRING })
  , Tool = sequelize.define('Tool', { name: Sequelize.STRING })
 
Task.belongsTo(User)
User.hasMany(Task)
User.hasMany(Tool, { as: 'Instruments' })
 
sequelize.sync().done(function() {
  // this is where we continue ...
})
```

OK&period; So&comma; first of all&comma; let's load all tasks with their associated user&period;

```js
Task.findAll({ include: [ User ] }).then(function(tasks) {
  console.log(JSON.stringify(tasks))
 
  /*
    [{
      "name": "A Task",
      "id": 1,
      "createdAt": "2013-03-20T20:31:40.000Z",
      "updatedAt": "2013-03-20T20:31:40.000Z",
      "UserId": 1,
      "user": {
        "name": "John Doe",
        "id": 1,
        "createdAt": "2013-03-20T20:31:45.000Z",
        "updatedAt": "2013-03-20T20:31:45.000Z"
      }
    }]
  */
})
```

Notice that the accessor of the associated data is the name of the model in camelcase with lowercased first character&period; Also the accessor is singular as the association is one-to-something&period;

Next thing&colon; Loading of data with many-to-something associations&excl;
    
```js
User.findAll({ include: [ Task ] }).then(function(users) {
  console.log(JSON.stringify(users))
 
  /*
    [{
      "name": "John Doe",
      "id": 1,
      "createdAt": "2013-03-20T20:31:45.000Z",
      "updatedAt": "2013-03-20T20:31:45.000Z",
      "tasks": [{
        "name": "A Task",
        "id": 1,
        "createdAt": "2013-03-20T20:31:40.000Z",
        "updatedAt": "2013-03-20T20:31:40.000Z",
        "UserId": 1
      }]
    }]
  */
})
```

Notice that the accessor is plural&period; This is because the association is many-to-something&period;

If an association is aliased &lpar;using the`as`option&rpar;&comma; you_must_specify this alias when including the model&period; Notice how the user's`Tool`s are aliased as`Instruments`above&period; In order to get that right you have to specify the model you want to load&comma; as well as the alias&colon;
    
```js
User.findAll({ include: [{ model: Tool, as: 'Instruments' }] }).then(function(users) {
  console.log(JSON.stringify(users))
 
  /*
    [{
      "name": "John Doe",
      "id": 1,
      "createdAt": "2013-03-20T20:31:45.000Z",
      "updatedAt": "2013-03-20T20:31:45.000Z",
      "instruments": [{
        "name": "Toothpick",
        "id": 1,
        "createdAt": null,
        "updatedAt": null,
        "UserId": 1
      }]
    }]
  */
})
```

### Ordering Eager Loaded Associations

In the case of a one-to-many relationship.
    
```js
Company.findAll({ include: [ Division ], order: [ [ Division, 'name' ] ] });
Company.findAll({ include: [ Division ], order: [ [ Division, 'name', 'DESC' ] ] });
Company.findAll({
  include: [ { model: Division, as: 'Div' } ],
  order: [ [ { model: Division, as: 'Div' }, 'name' ] ]
});
Company.findAll({
  include: [ { model: Division, include: [ Department ] } ],
  order: [ [ Division, Department, 'name' ] ]
});
```

In the case of many-to-many joins, you are also able to sort by attributes in the through table.
    
```js
Company.findAll({
  include: [ { model: Division, include: [ Department ] } ],
  order: [ [ Division, DepartmentDivision, 'name' ] ]
});
```

### Nested eager loading
```js
User.findAll({
  include: [
    {model: Tool, as: 'Instruments', include: [
      {model: Teacher, include: [ /* etc */]}
    ]}
  ]
}).then(function(users) {
  console.log(JSON.stringify(users))
 
  /*
    [{
      "name": "John Doe",
      "id": 1,
      "createdAt": "2013-03-20T20:31:45.000Z",
      "updatedAt": "2013-03-20T20:31:45.000Z",
      "instruments": [{ // 1:M and N:M association
        "name": "Toothpick",
        "id": 1,
        "createdAt": null,
        "updatedAt": null,
        "UserId": 1,
        "Teacher": { // 1:1 association
          "name": "Jimi Hendrix"
        }
      }]
    }]
  */
})
```

**Final note&colon;**If you include an object which is not associated&comma; Sequelize will throw an error&period;
    
```js
Tool.findAll({ include: [ User ] }).then(function(tools) {
  console.log(JSON.stringify(tools))
})
 
// Error: User is not associated to Tool!
```



[0]: #configuration
[1]: https://github.com/epeli/underscore.string
[2]: #get_and_set_helper_funcs
[3]: https://github.com/chriso/validator.js
[4]: https://github.com/chriso/node-validator
[5]: /docs/latest/misc#asynchronicity
[6]: https://github.com/petkaantonov/bluebird/blob/master/API.md#spreadfunction-fulfilledhandler--function-rejectedhandler----promise
