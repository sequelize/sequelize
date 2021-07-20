# \[MOVED\] Models Definition

The contents of this page were moved to [Model Basics](model-basics.html).

The only exception is the guide on `sequelize.import`, which is deprecated and was removed from the docs. However, if you really need it, it was kept here.

----

## Deprecated: `sequelize.import`

> _**Note:** You should not use `sequelize.import`. Please just use `require` instead._
>
> _This documentation has been kept just in case you really need to maintain old code that uses it._

You can store your model definitions in a single file using the `sequelize.import` method. The returned object is exactly the same as defined in the imported file's function. The import is cached, just like `require`, so you won't run into trouble if importing a file more than once.

```js
// in your server file - e.g. app.js
const Project = sequelize.import(__dirname + "/path/to/models/project");

// The model definition is done in /path/to/models/project.js
module.exports = (sequelize, DataTypes) => {
  return sequelize.define('project', {
    name: DataTypes.STRING,
    description: DataTypes.TEXT
  });
};
```

The `import` method can also accept a callback as an argument.

```js
sequelize.import('project', (sequelize, DataTypes) => {
  return sequelize.define('project', {
    name: DataTypes.STRING,
    description: DataTypes.TEXT
  });
});
```

This extra capability is useful when, for example, `Error: Cannot find module` is thrown even though `/path/to/models/project` seems to be correct. Some frameworks, such as Meteor, overload `require`, and might raise an error such as:

```text
Error: Cannot find module '/home/you/meteorApp/.meteor/local/build/programs/server/app/path/to/models/project.js'
```

This can be worked around by passing in Meteor's version of `require`:

```js
// If this fails...
const AuthorModel = db.import('./path/to/models/project');

// Try this instead!
const AuthorModel = db.import('project', require('./path/to/models/project'));
```