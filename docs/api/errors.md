<a name="errors"></a>
# Class Errors
[View code](https://github.com/sequelize/sequelize/blob/5aa77fa291abeaf0498f65724000c75da9ab9028/lib/errors.js#L11)
Sequelize provides a host of custom error classes, to allow you to do easier debugging. All of these errors are exposed on the sequelize object and the sequelize constructor.
All sequelize errors inherit from the base JS error object.


***

<a name="baseerror"></a>
## `new BaseError()`
[View code](https://github.com/sequelize/sequelize/blob/5aa77fa291abeaf0498f65724000c75da9ab9028/lib/errors.js#L20)
The Base Error all Sequelize Errors inherit from.

__Aliases:__ Error

***

<a name="validationerror"></a>
## `new ValidationError(message, [errors])`
[View code](https://github.com/sequelize/sequelize/blob/5aa77fa291abeaf0498f65724000c75da9ab9028/lib/errors.js#L40)
Validation Error. Thrown when the sequelize validation has failed. The error contains an `errors` property,
which is an array with 1 or more ValidationErrorItems, one for each validation that failed.


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | string | Error message |
| [errors] | Array | Array of ValidationErrorItem objects describing the validation errors  |


__Extends:__ BaseError

***

<a name="get"></a>
## `get(path)`
[View code](https://github.com/sequelize/sequelize/blob/5aa77fa291abeaf0498f65724000c75da9ab9028/lib/errors.js#L53)
Gets all validation error items for the path / field specified.


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| path | string | The path to be checked for error items |


***

<a name="errors"></a>
## `errors()`
[View code](https://github.com/sequelize/sequelize/blob/5aa77fa291abeaf0498f65724000c75da9ab9028/lib/errors.js#L67)
An array of ValidationErrorItems

***

<a name="databaseerror"></a>
## `new DatabaseError()`
[View code](https://github.com/sequelize/sequelize/blob/5aa77fa291abeaf0498f65724000c75da9ab9028/lib/errors.js#L74)
A base class for all database related errors.

__Extends:__ BaseError

***

<a name="parent"></a>
## `parent()`
[View code](https://github.com/sequelize/sequelize/blob/5aa77fa291abeaf0498f65724000c75da9ab9028/lib/errors.js#L88)
The database specific error which triggered this one

***

<a name="sql"></a>
## `sql()`
[View code](https://github.com/sequelize/sequelize/blob/5aa77fa291abeaf0498f65724000c75da9ab9028/lib/errors.js#L94)
The SQL that triggered the error

***

<a name="timeouterror"></a>
## `new TimeoutError()`
[View code](https://github.com/sequelize/sequelize/blob/5aa77fa291abeaf0498f65724000c75da9ab9028/lib/errors.js#L101)
Thrown when a database query times out because of a deadlock

__Extends:__ DatabaseError

***

<a name="uniqueconstrainterror"></a>
## `new UniqueConstraintError()`
[View code](https://github.com/sequelize/sequelize/blob/5aa77fa291abeaf0498f65724000c75da9ab9028/lib/errors.js#L112)
Thrown when a unique constraint is violated in the database

__Extends:__ DatabaseError

***

<a name="foreignkeyconstrainterror"></a>
## `new ForeignKeyConstraintError()`
[View code](https://github.com/sequelize/sequelize/blob/5aa77fa291abeaf0498f65724000c75da9ab9028/lib/errors.js#L131)
Thrown when a foreign key constraint is violated in the database

__Extends:__ DatabaseError

***

<a name="message"></a>
## `message()`
[View code](https://github.com/sequelize/sequelize/blob/5aa77fa291abeaf0498f65724000c75da9ab9028/lib/errors.js#L151)
The message from the DB.

***

<a name="fields"></a>
## `fields()`
[View code](https://github.com/sequelize/sequelize/blob/5aa77fa291abeaf0498f65724000c75da9ab9028/lib/errors.js#L157)
The fields of the unique constraint

***

<a name="value"></a>
## `value()`
[View code](https://github.com/sequelize/sequelize/blob/5aa77fa291abeaf0498f65724000c75da9ab9028/lib/errors.js#L163)
The value(s) which triggered the error

***

<a name="index"></a>
## `index()`
[View code](https://github.com/sequelize/sequelize/blob/5aa77fa291abeaf0498f65724000c75da9ab9028/lib/errors.js#L169)
The name of the index that triggered the error

***

<a name="validationerroritem"></a>
## `new ValidationErrorItem(message, type, path, value)`
[View code](https://github.com/sequelize/sequelize/blob/5aa77fa291abeaf0498f65724000c75da9ab9028/lib/errors.js#L181)
Validation Error Item
Instances of this class are included in the `ValidationError.errors` property.


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | string | An error message |
| type | string | The type of the validation error |
| path | string | The field that triggered the validation error |
| value | string | The value that generated the error |


***

_This document is automatically generated based on source code comments. Please do not edit it directly, as your changes will be ignored. Please write on <a href="irc://irc.freenode.net/#sequelizejs">IRC</a>, open an issue or a create a pull request if you feel something can be improved. For help on how to write source code documentation see [JSDoc](http://usejsdoc.org) and [dox](https://github.com/tj/dox)_