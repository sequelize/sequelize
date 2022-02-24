# Upgrade to v7

Sequelize v7 is the next major release after v6. Below is a list of breaking changes to help you upgrade.

## Breaking Changes

### Main project renamed to @sequelize/core

Starting with Sequelize v7, we are introducing scoped modules and renamed the following projects:

- The former `sequelize` module is now available under `@sequelize/core`.

As a result, you now use Sequelize as follows:

```javascript
const { Sequelize } = require('@sequelize/core');
const sequelize = new Sequelize({ dialect: 'sqlite' });

await sequelize.authenticate();
```

### Support for Node 12 and up

Sequelize v7 will only support those versions of Node.js that are compatible with the ES module specification,
namingly version 12 and upwards [#5](https://github.com/sequelize/meetings/issues/5).

### TypeScript conversion

One of the major foundational code changes of v7 is the migration to TypeScript.
As a result, the manual typings that were formerly best-effort guesses on top of the JavaScript code base,
have been removed and all typings are now directly retrieved from the actual TypeScript code.
You'll likely find many tiny differences which however should be easy to fix.

### Attributes cannot start and end with `$`, or include `.`

`$attribute$` & `$nested.attribute$` is a special syntax used to reference nested attributes in Queries.
The `.` character also has special meaning, being used to reference nested JSON object keys,
the `$nested.attribute$` syntax, and in output names of eager-loaded associations in SQL queries.

In Sequelize 6, it was possible to create an attribute that matched this special syntax, leading to subtle bugs.
Starting with Sequelize 7, this is now considered reserved syntax, and it is no longer possible to
use a string that both starts and ends with a `$` as the attribute name, or includes the `.` character.

This only affects the attribute name, it is still possible to do this for the column name.

Instead of doing this:

```typescript
import { DataTypes, Model } from '@sequelize/core';

class User extends Model {
  $myAttribute$: string;
  'another.attribute': string;
}

User.init({
  // this key sets the JavaScript name.
  // It's not allowed to start & end with $ anymore.
  '$myAttribute$': {
    type: DataTypes.STRING,
    // 'field' sets the column name
    field: '$myAttribute$'
  },
  // The JavaScript name is not allowed to include a dot anymore.
  'another.attribute': {
    type: DataTypes.STRING,
    field: 'another.attribute'
  }
}, { sequelize });
```

Do this:

```typescript
import { DataTypes, Model } from '@sequelize/core';

class User extends Model {
  $myAttribute$: string;
  'another.attribute': string;
}

User.init({
  'myAttribute': {
    type: DataTypes.STRING,
    // Column names are still allowed to start & end with $
    field: '$myAttribute$'
  },
  'anotherAttribute': {
    type: DataTypes.STRING,
    // Column names are still allowed to include dots
    field: 'another.attribute' // this sets the column name
  }
}, { sequelize });
```

### Changes to `ConnectionManager`

*This only impacts you if you used `ConnectionManager` directly.*

`ConnectionManager#getConnection`: The `type` option now accepts `'read' | 'write'` instead of `'SELECT' | any`.
It was already documented as such in v6, but the implementation did not match the documentation.

```typescript
// Instead of doing this:
sequelize.connectionManager.getConnection({ type: 'SELECT' });

// Do this:
sequelize.connectionManager.getConnection({ type: 'read' });
```

### Microsoft SQL Server Support

Sequelize v7 fully supports MS SQL Server 2017 (version 14) onwards, up from 2012 (version 13) in
Sequelize v6, as this matches Microsoft's own [mainstream support](
https://docs.microsoft.com/en-us/sql/sql-server/end-of-support/sql-server-end-of-life-overview?view=sql-server-ver15#lifecycle-dates).

### Overridden Model methods won't be called internally

`Model.findOne` and `Model.findAll` are used respectively by `Model.findByPk` and `Model.findOne`.
This is considered an implementation detail and as such, starting with Sequelize v7,
overrides of either of these methods will not be called internally by `Model.findByPk` or `Model.findOne`.

In other words, doing this won't break:

```typescript
class User extends Model {
  static findOne() {
    throw new Error('Do not call findOne');
  }
}

// this would have thrown "Do not call findOne" in v6
// but it works in v7
User.findByPk(1);
```
