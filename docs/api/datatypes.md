<a name="datatypes"></a>
# Class DataTypes
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/data-types.js#L41)

A convenience class holding commonly used data types. The datatypes are used when defining a new model using `Sequelize.define`, like this:
```js
sequelize.define('model', {
  column: DataTypes.INTEGER
})
```
When defining a model you can just as easily pass a string as type, but often using the types defined here is beneficial. For example, using `DataTypes.BLOB`, mean
that that column will be returned as an instance of `Buffer` when being fetched by sequelize.

Some data types have special properties that can be accessed in order to change the data type.
For example, to get an unsigned integer with zerofill you can do `DataTypes.INTEGER.UNSIGNED.ZEROFILL`.
The order you access the properties in do not matter, so `DataTypes.INTEGER.ZEROFILL.UNSIGNED` is fine as well. The available properties are listed under each data type.

To provide a length for the data type, you can invoke it like a function: `INTEGER(2)`

Three of the values provided here (`NOW`, `UUIDV1` and `UUIDV4`) are special default values, that should not be used to define types. Instead they are used as shorthands for
defining default values. For example, to get a uuid field with a default value generated following v1 of the UUID standard:
```js
sequelize.define('model', {
  uuid: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV1,
    primaryKey: true
  }
})
```

***

<a name="string"></a>
## `STRING()`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/data-types.js#L67)

A variable length string. Default length 255

Available properties: `BINARY`

***

<a name="char"></a>
## `CHAR()`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/data-types.js#L110)

A fixed length string. Default length 255

Available properties: `BINARY`

***

<a name="text"></a>
## `TEXT()`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/data-types.js#L130)

An (un)limited length text column. Available lengths: `tiny`, `medium`, `long`

***

<a name="integer"></a>
## `INTEGER()`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/data-types.js#L219)

A 32 bit integer.

Available properties: `UNSIGNED`, `ZEROFILL`

***

<a name="bigint"></a>
## `BIGINT()`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/data-types.js#L245)

A 64 bit integer.

Available properties: `UNSIGNED`, `ZEROFILL`

***

<a name="float"></a>
## `FLOAT()`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/data-types.js#L270)

Floating point number (4-byte precision). Accepts one or two arguments for precision

Available properties: `UNSIGNED`, `ZEROFILL`

***

<a name="real"></a>
## `REAL()`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/data-types.js#L296)

Floating point number (4-byte precision). Accepts one or two arguments for precision

Available properties: `UNSIGNED`, `ZEROFILL`

***

<a name="double"></a>
## `DOUBLE()`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/data-types.js#L315)

Floating point number (8-byte precision). Accepts one or two arguments for precision

Available properties: `UNSIGNED`, `ZEROFILL`

***

<a name="decimal"></a>
## `DECIMAL()`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/data-types.js#L334)

Decimal number. Accepts one or two arguments for precision

Available properties: `UNSIGNED`, `ZEROFILL`

***

<a name="boolean"></a>
## `BOOLEAN()`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/data-types.js#L364)

A boolean / tinyint column, depending on dialect

***

<a name="time"></a>
## `TIME()`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/data-types.js#L387)

A time column

***

<a name="date"></a>
## `DATE()`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/data-types.js#L402)

A datetime column

***

<a name="dateonly"></a>
## `DATEONLY()`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/data-types.js#L424)

A date only column

***

<a name="hstore"></a>
## `HSTORE()`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/data-types.js#L440)

A key / value column. Only available in postgres.

***

<a name="json"></a>
## `JSON()`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/data-types.js#L459)

A JSON string column. Only available in postgres.

***

<a name="jsonb"></a>
## `JSONB()`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/data-types.js#L474)

A pre-processed JSON data column. Only available in postgres.

***

<a name="now"></a>
## `NOW()`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/data-types.js#L486)

A default value of the current timestamp

***

<a name="blob"></a>
## `BLOB()`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/data-types.js#L500)

Binary storage. Available lengths: `tiny`, `medium`, `long`

***

<a name="range"></a>
## `RANGE()`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/data-types.js#L537)

Range types are data types representing a range of values of some element type (called the range's subtype).
Only available in postgres.
See {@link http://www.postgresql.org/docs/9.4/static/rangetypes.html|Postgres documentation} for more details

***

<a name="uuid"></a>
## `UUID()`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/data-types.js#L581)

A column storing a unique univeral identifier. Use with `UUIDV1` or `UUIDV4` for default values.

***

<a name="uuidv1"></a>
## `UUIDV1()`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/data-types.js#L601)

A default unique universal identifier generated following the UUID v1 standard

***

<a name="uuidv4"></a>
## `UUIDV4()`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/data-types.js#L621)

A default unique universal identifier generated following the UUID v4 standard

***

<a name="virtual"></a>
## `VIRTUAL()`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/data-types.js#L678)

A virtual value that is not stored in the DB. This could for example be useful if you want to provide a default value in your model that is returned to the user but not stored in the DB.

You could also use it to validate a value before permuting and storing it. Checking password length before hashing it for example:
```js
sequelize.define('user', {
  password_hash: DataTypes.STRING,
  password: {
    type: DataTypes.VIRTUAL,
    set: function (val) {
       this.setDataValue('password', val); // Remember to set the data value, otherwise it won't be validated
       this.setDataValue('password_hash', this.salt + val);
     },
     validate: {
        isLongEnough: function (val) {
          if (val.length < 7) {
            throw new Error("Please choose a longer password")
         }
      }
    }
  }
})
```

VIRTUAL also takes a return type and dependency fields as arguments
If a virtual attribute is present in `attributes` it will automatically pull in the extra fields aswell.
Return type is mostly usefull for setups that rely on types like GraphQL.
```js
{
  active: {
    type: new DataTypes.VIRTUAL(DataTypes.BOOLEAN, ['createdAt']),
    get: function() {
      return this.get('createdAt') > Date.now() - (7 * 24 * 60 * 60 * 1000)
    }
  }
}
```

In the above code the password is stored plainly in the password field so it can be validated, but is never stored in the DB.
__Aliases:__ NONE

***

<a name="enum"></a>
## `ENUM()`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/data-types.js#L694)

An enumeration. `DataTypes.ENUM('value', 'another value')`.

***

<a name="array"></a>
## `ARRAY()`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/data-types.js#L718)

An array of `type`, e.g. `DataTypes.ARRAY(DataTypes.DECIMAL)`. Only available in postgres.

***

_This document is automatically generated based on source code comments. Please do not edit it directly, as your changes will be ignored. Please write on <a href="irc://irc.freenode.net/#sequelizejs">IRC</a>, open an issue or a create a pull request if you feel something can be improved. For help on how to write source code documentation see [JSDoc](http://usejsdoc.org) and [dox](https://github.com/tj/dox)_
