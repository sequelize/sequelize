# Extending Data Types

Most likely the type you are trying to implement is already included in [DataTypes](data-types.html). If a new datatype is not included, this manual will show how to write it yourself.

Sequelize doesn't create new datatypes in the database. This tutorial explains how to make Sequelize recognize new datatypes and assumes that those new datatypes are already created in the database.

To extend Sequelize datatypes, do it before any Sequelize instance is created.

## Example

In this example, we will create a type called `SOMETYPE` that replicates the built-in datatype `DataTypes.INTEGER(11).ZEROFILL.UNSIGNED`.

```js
const { Sequelize, DataTypes, Utils } = require('Sequelize');
createTheNewDataType();
const sequelize = new Sequelize('sqlite::memory:');

function createTheNewDataType() {

  class SOMETYPE extends DataTypes.ABSTRACT {
    // Mandatory: complete definition of the new type in the database
    toSql() {
      return 'INTEGER(11) UNSIGNED ZEROFILL'
    }

    // Optional: validator function
    validate(value, options) {
      return (typeof value === 'number') && (!Number.isNaN(value));
    }

    // Optional: sanitizer
    _sanitize(value) {
      // Force all numbers to be positive
      return value < 0 ? 0 : Math.round(value);
    }

    // Optional: value stringifier before sending to database
    _stringify(value) {
      return value.toString();
    }

    // Optional: parser for values received from the database
    static parse(value) {
      return Number.parseInt(value);
    }
  }

  // Mandatory: set the type key
  SOMETYPE.prototype.key = SOMETYPE.key = 'SOMETYPE';

  // Mandatory: add the new type to DataTypes. Optionally wrap it on `Utils.classToInvokable` to
  // be able to use this datatype directly without having to call `new` on it.
  DataTypes.SOMETYPE = Utils.classToInvokable(SOMETYPE);

  // Optional: disable escaping after stringifier. Do this at your own risk, since this opens opportunity for SQL injections.
  // DataTypes.SOMETYPE.escape = false;

}
```

After creating this new datatype, you need to map this datatype in each database dialect and make some adjustments.

## PostgreSQL

Let's say the name of the new datatype is `pg_new_type` in the postgres database. That name has to be mapped to `DataTypes.SOMETYPE`. Additionally, it is required to create a child postgres-specific datatype.

```js
function createTheNewDataType() {
  // [...]

  const PgTypes = DataTypes.postgres;

  // Mandatory: map postgres datatype name
  DataTypes.SOMETYPE.types.postgres = ['pg_new_type'];

  // Mandatory: create a postgres-specific child datatype with its own parse
  // method. The parser will be dynamically mapped to the OID of pg_new_type.
  PgTypes.SOMETYPE = function SOMETYPE() {
    if (!(this instanceof PgTypes.SOMETYPE)) {
      return new PgTypes.SOMETYPE();
    }
    DataTypes.SOMETYPE.apply(this, arguments);
  }
  const util = require('util'); // Built-in Node package
  util.inherits(PgTypes.SOMETYPE, DataTypes.SOMETYPE);

  // Mandatory: create, override or reassign a postgres-specific parser
  // PgTypes.SOMETYPE.parse = value => value;
  PgTypes.SOMETYPE.parse = DataTypes.SOMETYPE.parse || x => x;

  // Optional: add or override methods of the postgres-specific datatype
  // like toSql, escape, validate, _stringify, _sanitize...

}
```

### Ranges

After a new range type has been [defined in postgres](https://www.postgresql.org/docs/current/static/rangetypes.html#RANGETYPES-DEFINING), it is trivial to add it to Sequelize.

In this example the name of the postgres range type is `SOMETYPE_range` and the name of the underlying postgres datatype is `pg_new_type`. The key of `subtypes` and `castTypes` is the key of the Sequelize datatype `DataTypes.SOMETYPE.key`, in lower case.

```js
function createTheNewDataType() {
  // [...]

  // Add postgresql range, SOMETYPE comes from DataType.SOMETYPE.key in lower case
  DataTypes.RANGE.types.postgres.subtypes.SOMETYPE = 'SOMETYPE_range';
  DataTypes.RANGE.types.postgres.castTypes.SOMETYPE = 'pg_new_type';
}
```

The new range can be used in model definitions as `DataTypes.RANGE(DataTypes.SOMETYPE)` or `DataTypes.RANGE(DataTypes.SOMETYPE)`.
