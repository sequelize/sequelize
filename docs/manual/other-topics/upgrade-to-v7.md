# Upgrade to v7

Sequelize v7 is the next major release after v6. Below is a list of breaking changes to help you upgrade.

## Highlights

Sequelize 7 is a release with lots of breaking changes, but it is also filled with improvements and new features!

### Simplified TypeScript integration

Take a look at our [updated TypeScript guide](https://sequelize.org/v7/manual/typescript.html).
We hope you'll find that integrating Sequelize with TypeScript in v7 is much easier than in v6.

## Breaking Changes

### Support for Node 12 and up

Sequelize v7 will only support those versions of Node.js that are compatible with the ES module specification,
namingly version 12 and upwards [#5](https://github.com/sequelize/meetings/issues/5).

### TypeScript conversion

One of the major foundational code changes of v7 is the migration to TypeScript.
As a result, the manual typings that were formerly best-effort guesses on top of the JavaScript code base,
have been removed and all typings are now directly retrieved from the actual TypeScript code.
You'll likely find many tiny differences which however should be easy to fix.

#### Changes to class-based Model typings

Typings for Models have been greatly simplified. Instead of having to write something like the following:

```typescript
import { Model, Optional } from 'sequelize';

type UserAttributes = {
  id: number;
  firstName: string;
};

type UserCreationAttributes = Optional<UserAttributes, 'id'>;

class User extends Model<UserAttributes, UserCreationAttributes> {
  declare id: number;
  declare firstName: string;
}
```

You instead need to write it like this:

```typescript
import { Model, CreationOptional } from 'sequelize';

class User extends Model<User> {
  // attribute 'id' has a default value, it can be omitted from Model.create and other creation methods
  // `CreationOptional` marks it as such in the typings.
  declare id: CreationOptional<number>;
  declare firstName: string;
}
```

We recommend you take a look at [the updated TypeScript guide for Sequelize](https://sequelize.org/v7/manual/typescript.html).

Note: If you were already using `InferAttributes` & `InferCreationAttributes` in Sequelize 6,
then your code already looked like the one above. Simply change how you extend the Model class
from `Model<InferAttributes<User>, InferCreationAttributes<User>>` to `Model<User>`

#### Changes to `sequelize.define`-based model typings

`ModelDefined` has been updated to match how the `Model` class works.

Instead of writing this:

```typescript
import { ModelDefined, Optional } from 'sequelize';

type UserAttributes = {
  id: number;
  firstName: string;
};

type UserCreationAttributes = Optional<UserAttributes, 'id'>;

const User: ModelDefined<UserAttributes, UserCreationAttributes> = sequelize.define('User', {
  id: DataTypes.INTEGER,
  firstName: DataTypes.STRING,
});
```

You need to write it like this:

```typescript
import { ModelDefined, CreationOptional } from 'sequelize';

type UserAttributes = {
  // attribute 'id' has a default value, it can be omitted from Model.create and other creation methods
  // `CreationOptional` marks it as such in the typings.
  id: CreationOptional<number>;
  firstName: string;
};

const User: ModelDefined<UserAttributes> = sequelize.define('User', {
  id: DataTypes.INTEGER,
  firstName: DataTypes.STRING,
});
```

#### Changes to Static Model typings

We improved the typing of `ModelStatic` in Sequelize v6. It now fulfils the role that was previously split
between `ModelCtor`, `ModelType`, and `ModelStatic`.

It is typically safe to simply replace any use of those with `ModelStatic`.

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
