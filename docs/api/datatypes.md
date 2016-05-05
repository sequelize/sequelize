<a name="datatypes"></a>
# Class DataTypes
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/data-types.js#L57)

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
There may be times when you want to generate your own UUID conforming to some other algorithm. This is accomplised
using the defaultValue property as well, but instead of specifying one of the supplied UUID types, you return a value
from a function.
```js
sequelize.define('model', {
  uuid: {
    type: DataTypes.UUID,
    defaultValue: function() {
      return generateMyId()
    },
    primaryKey: true
  }
})
```

***

<a name="string"></a>
## `STRING()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/data-types.js#L109)

A variable length string. Default length 255

Available properties: `BINARY`

***

<a name="char"></a>
## `CHAR()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/data-types.js#L151)

A fixed length string. Default length 255

Available properties: `BINARY`

***

<a name="text"></a>
## `TEXT()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/data-types.js#L170)

An (un)limited length text column. Available lengths: `tiny`, `medium`, `long`

***

<a name="integer"></a>
## `INTEGER()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/data-types.js#L258)

A 32 bit integer.

Available properties: `UNSIGNED`, `ZEROFILL`

***

<a name="bigint"></a>
## `BIGINT()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/data-types.js#L283)

A 64 bit integer.

Note: an attribute defined as `BIGINT` will be treated like a `string` due this [feature from node-postgres](https://github.com/brianc/node-postgres/pull/353) to prevent precision loss. To have this attribute as a `number`, this is a possible [workaround](https://github.com/sequelize/sequelize/issues/2383#issuecomment-58006083).

Available properties: `UNSIGNED`, `ZEROFILL`

***

<a name="float"></a>
## `FLOAT()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/data-types.js#L307)

Floating point number (4-byte precision). Accepts one or two arguments for precision

Available properties: `UNSIGNED`, `ZEROFILL`

***

<a name="real"></a>
## `REAL()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/data-types.js#L332)

Floating point number (4-byte precision). Accepts one or two arguments for precision

Available properties: `UNSIGNED`, `ZEROFILL`

***

<a name="double"></a>
## `DOUBLE()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/data-types.js#L350)

Floating point number (8-byte precision). Accepts one or two arguments for precision

Available properties: `UNSIGNED`, `ZEROFILL`

***

<a name="decimal"></a>
## `DECIMAL()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/data-types.js#L368)

Decimal number. Accepts one or two arguments for precision

Available properties: `UNSIGNED`, `ZEROFILL`

***

<a name="boolean"></a>
## `BOOLEAN()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/data-types.js#L397)

A boolean / tinyint column, depending on dialect

***

<a name="time"></a>
## `TIME()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/data-types.js#L416)

A time column

***

<a name="date"></a>
## `DATE()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/data-types.js#L427)

A datetime column

***

<a name="dateonly"></a>
## `DATEONLY()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/data-types.js#L476)

A date only column

***

<a name="hstore"></a>
## `HSTORE()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/data-types.js#L492)

A key / value column. Only available in postgres.

***

<a name="json"></a>
## `JSON()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/data-types.js#L507)

A JSON string column. Only available in postgres.

***

<a name="jsonb"></a>
## `JSONB()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/data-types.js#L526)

A pre-processed JSON data column. Only available in postgres.

***

<a name="now"></a>
## `NOW()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/data-types.js#L538)

A default value of the current timestamp

***

<a name="blob"></a>
## `BLOB()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/data-types.js#L548)

Binary storage. Available lengths: `tiny`, `medium`, `long`

***

<a name="range"></a>
## `RANGE()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/data-types.js#L603)

Range types are data types representing a range of values of some element type (called the range's subtype).
Only available in postgres.
See {@link http://www.postgresql.org/docs/9.4/static/rangetypes.html|Postgres documentation} for more details

***

<a name="uuid"></a>
## `UUID()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/data-types.js#L653)

A column storing a unique universal identifier. Use with `UUIDV1` or `UUIDV4` for default values.

***

<a name="uuidv1"></a>
## `UUIDV1()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/data-types.js#L669)

A default unique universal identifier generated following the UUID v1 standard

***

<a name="uuidv4"></a>
## `UUIDV4()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/data-types.js#L689)

A default unique universal identifier generated following the UUID v4 standard

***

<a name="virtual"></a>
## `VIRTUAL()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/data-types.js#L746)

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
In the above code the password is stored plainly in the password field so it can be validated, but is never stored in the DB.

VIRTUAL also takes a return type and dependency fields as arguments
If a virtual attribute is present in `attributes` it will automatically pull in the extra fields as well.
Return type is mostly useful for setups that rely on types like GraphQL.
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

__Aliases:__ NONE

***

<a name="enum"></a>
## `ENUM()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/data-types.js#L762)

An enumeration. `DataTypes.ENUM('value', 'another value')`.

***

<a name="array"></a>
## `ARRAY()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/data-types.js#L786)

An array of `type`, e.g. `DataTypes.ARRAY(DataTypes.DECIMAL)`. Only available in postgres.

***

<a name="geometry"></a>
## `GEOMETRY()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/data-types.js#L869)

A column storing Geometry information.  

Only available in PostgreSQL (with PostGIS) or MySQL.  
In MySQL, allowable Geometry types are 'POINT', 'LINESTRING', 'POLYGON'.

When using, GeoJSON is accepted as input and returned as output.  
In PostGIS, the GeoJSON is parsed using the PostGIS function `ST_GeomFromGeoJSON`.  
In MySQL it is parsed using the function `GeomFromText`.  
Therefore, one can just follow the [GeoJSON spec](http://geojson.org/geojson-spec.html) for handling geometry objects.  See the following examples:

```js
// Create a new point:
var point = { type: 'Point', coordinates: [39.807222,-76.984722]};

User.create({username: 'username', geometry: point }).then(function(newUser) {
...
});

// Create a new linestring:
var line = { type: 'LineString', 'coordinates': [ [100.0, 0.0], [101.0, 1.0] ] };

User.create({username: 'username', geometry: line }).then(function(newUser) {
...
});

// Create a new polygon:
var polygon = { type: 'Polygon', coordinates: [
                [ [100.0, 0.0], [101.0, 0.0], [101.0, 1.0],
                  [100.0, 1.0], [100.0, 0.0] ] 
                ]};

User.create({username: 'username', geometry: polygon }).then(function(newUser) {
...
});

// Create a new point with a custom SRID:
var point = { 
  type: 'Point', 
  coordinates: [39.807222,-76.984722],
  crs: { type: 'name', properties: { name: 'EPSG:4326'} }
};

User.create({username: 'username', geometry: point }).then(function(newUser) {
...
});
```

***

<a name="geography"></a>
## `GEOGRAPHY()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/data-types.js#L894)

A geography datatype represents two dimensional spacial objects in an elliptic coord system.

***

_This document is automatically generated based on source code comments. Please do not edit it directly, as your changes will be ignored. Please write on <a href="irc://irc.freenode.net/#sequelizejs">IRC</a>, open an issue or a create a pull request if you feel something can be improved. For help on how to write source code documentation see [JSDoc](http://usejsdoc.org) and [dox](https://github.com/tj/dox)_
