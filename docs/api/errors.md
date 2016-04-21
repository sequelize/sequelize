<a name="errors"></a>
# Class Errors
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/errors.js#L11)

Sequelize provides a host of custom error classes, to allow you to do easier debugging. All of these errors are exposed on the sequelize object and the sequelize constructor.
All sequelize errors inherit from the base JS error object.

***

<a name="baseerror"></a>
## `new BaseError()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/errors.js#L20)

The Base Error all Sequelize Errors inherit from.
__Aliases:__ Error

***

<a name="validationerror"></a>
## `new ValidationError(message, [errors])`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/errors.js#L41)

Validation Error. Thrown when the sequelize validation has failed. The error contains an `errors` property,
which is an array with 1 or more ValidationErrorItems, one for each validation that failed.

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | string | Error message |
| [errors] | Array | Array of ValidationErrorItem objects describing the validation errors |


__Extends:__ BaseError

***

<a name="errors"></a>
## `errors`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/errors.js#L49)

An array of ValidationErrorItems

***

<a name="get"></a>
## `get(path)`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/errors.js#L70)

Gets all validation error items for the path / field specified.

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| path | string | The path to be checked for error items |


***

<a name="databaseerror"></a>
## `new DatabaseError()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/errors.js#L84)

A base class for all database related errors.

__Extends:__ BaseError

***

<a name="parent"></a>
## `parent`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/errors.js#L92)

The database specific error which triggered this one

***

<a name="sql"></a>
## `sql`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/errors.js#L98)

The SQL that triggered the error

***

<a name="message"></a>
## `message()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/errors.js#L104)

The message from the DB.

***

<a name="fields"></a>
## `fields()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/errors.js#L109)

The fields of the unique constraint

***

<a name="value"></a>
## `value()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/errors.js#L114)

The value(s) which triggered the error

***

<a name="index"></a>
## `index()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/errors.js#L119)

The name of the index that triggered the error

***

<a name="timeouterror"></a>
## `new TimeoutError()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/errors.js#L127)

Thrown when a database query times out because of a deadlock

__Extends:__ DatabaseError

***

<a name="uniqueconstrainterror"></a>
## `new UniqueConstraintError()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/errors.js#L138)

Thrown when a unique constraint is violated in the database

__Extends:__ DatabaseError

***

<a name="foreignkeyconstrainterror"></a>
## `new ForeignKeyConstraintError()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/errors.js#L157)

Thrown when a foreign key constraint is violated in the database

__Extends:__ DatabaseError

***

<a name="exclusionconstrainterror"></a>
## `new ExclusionConstraintError()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/errors.js#L177)

Thrown when an exclusion constraint is violated in the database

__Extends:__ DatabaseError

***

<a name="validationerroritem"></a>
## `new ValidationErrorItem(message, type, path, value)`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/errors.js#L201)

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

<a name="connectionerror"></a>
## `new ConnectionError()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/errors.js#L213)

A base class for all connection related errors.

__Extends:__ BaseError

***

<a name="parent"></a>
## `parent`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/errors.js#L220)

The connection specific error which triggered this one

***

<a name="connectionrefusederror"></a>
## `new ConnectionRefusedError()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/errors.js#L230)

Thrown when a connection to a database is refused

__Extends:__ ConnectionError

***

<a name="accessdeniederror"></a>
## `new AccessDeniedError()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/errors.js#L241)

Thrown when a connection to a database is refused due to insufficient privileges

__Extends:__ ConnectionError

***

<a name="hostnotfounderror"></a>
## `new HostNotFoundError()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/errors.js#L252)

Thrown when a connection to a database has a hostname that was not found

__Extends:__ ConnectionError

***

<a name="hostnotreachableerror"></a>
## `new HostNotReachableError()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/errors.js#L263)

Thrown when a connection to a database has a hostname that was not reachable

__Extends:__ ConnectionError

***

<a name="invalidconnectionerror"></a>
## `new InvalidConnectionError()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/errors.js#L274)

Thrown when a connection to a database has invalid values for any of the connection parameters

__Extends:__ ConnectionError

***

<a name="connectiontimedouterror"></a>
## `new ConnectionTimedOutError()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/errors.js#L285)

Thrown when a connection to a database times out

__Extends:__ ConnectionError

***

<a name="instanceerror"></a>
## `new InstanceError()`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/errors.js#L296)

Thrown when a some problem occurred with Instance methods (see message for details)

__Extends:__ BaseError

***

_This document is automatically generated based on source code comments. Please do not edit it directly, as your changes will be ignored. Please write on <a href="irc://irc.freenode.net/#sequelizejs">IRC</a>, open an issue or a create a pull request if you feel something can be improved. For help on how to write source code documentation see [JSDoc](http://usejsdoc.org) and [dox](https://github.com/tj/dox)_