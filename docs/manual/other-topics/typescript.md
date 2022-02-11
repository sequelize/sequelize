# TypeScript

Sequelize provides its own TypeScript definitions.

Please note that only **TypeScript >= 4.1** is supported.
Our TypeScript support does not follow SemVer. We will support TypeScript releases for at least one year, after which they may be dropped in a SemVer MINOR release.

As Sequelize heavily relies on runtime property assignments, TypeScript won't be very useful out of the box.
A decent amount of manual type declarations are needed to make models workable.

## Installation

In order to avoid installation bloat for non TS users, you must install the following typing packages manually:

- `@types/node` (this is universally required in node projects)
- `@types/validator`

## Recommended Usage

**Important**: You must use `declare` on your class properties typings to ensure TypeScript does not emit those class properties.
See [Caveat with Public Class Fields](./model-basics.html#caveat-with-public-class-fields)

Here is an example of a minimal TypeScript project with strict type-checking for attributes:

[//]: # (NOTE for maintainers: Keep the following code in sync with `/types/test/typescriptDocs/ModelInit.ts` to ensure it typechecks correctly.)

```typescript
/**
 * Keep this file in sync with the code in the "Usage" section
 * in /docs/manual/other-topics/typescript.md
 *
 * Don't include this comment in the md file.
 */
import {
  Association, DataTypes, HasManyAddAssociationMixin, HasManyCountAssociationsMixin,
  HasManyCreateAssociationMixin, HasManyGetAssociationsMixin, HasManyHasAssociationMixin,
  HasManySetAssociationsMixin, HasManyAddAssociationsMixin, HasManyHasAssociationsMixin,
  HasManyRemoveAssociationMixin, HasManyRemoveAssociationsMixin, Model,
  Sequelize, CreationOptional, NonAttribute, ModelDefined,
} from 'sequelize';

const sequelize = new Sequelize('mysql://root:asd123@localhost:3306/mydb');

// 'projects' is excluded as it's not an attribute, it's an association.
class User extends Model<User, { omit: 'projects' }> {
  // id can be undefined during creation when using `autoIncrement`
  declare id: CreationOptional<number>;
  declare name: string;
  declare preferredName: string | null; // for nullable fields

  // timestamps!
  // createdAt can be undefined during creation
  declare createdAt: CreationOptional<Date>;
  // updatedAt can be undefined during creation
  declare updatedAt: CreationOptional<Date>;

  // Since TS cannot determine model association at compile time
  // we have to declare them here purely virtually
  // these will not exist until `Model.init` has been called.
  declare getProjects: HasManyGetAssociationsMixin<Project>;
  declare addProject: HasManyAddAssociationMixin<Project, number>;
  declare addProjects: HasManyAddAssociationsMixin<Project, number>;
  declare setProjects: HasManySetAssociationsMixin<Project, number>;
  declare removeProject: HasManyRemoveAssociationMixin<Project, number>;
  declare removeProjects: HasManyRemoveAssociationsMixin<Project, number>;
  declare hasProject: HasManyHasAssociationMixin<Project, number>;
  declare hasProjects: HasManyHasAssociationsMixin<Project, number>;
  declare countProjects: HasManyCountAssociationsMixin;
  declare createProject: HasManyCreateAssociationMixin<Project, 'ownerId'>;

  // You can also pre-declare possible inclusions, these will only be populated if you
  // actively include a relation.
  // Note: this is optional since it's only populated when explicitly requested in code
  declare projects?: NonAttribute<Project[]>;

  // getters that are not attributes should be tagged using NonAttribute
  // to remove them from the model's Attribute Typings.
  get fullName(): NonAttribute<string> {
    return this.name;
  }

  declare static associations: {
    projects: Association<User, Project>;
  };
}

class Project extends Model<Project> {
  // id can be undefined during creation when using `autoIncrement`
  declare id: CreationOptional<number>;
  declare ownerId: number;
  declare name: string;

  // `owner` is an eagerly-loaded association.
  // We tag it as `NonAttribute`
  declare owner?: NonAttribute<User>;

  // createdAt can be undefined during creation
  declare createdAt: CreationOptional<Date>;
  // updatedAt can be undefined during creation
  declare updatedAt: CreationOptional<Date>;
}

class Address extends Model<Address> {
  declare userId: number;
  declare address: string;

  // createdAt can be undefined during creation
  declare createdAt: CreationOptional<Date>;
  // updatedAt can be undefined during creation
  declare updatedAt: CreationOptional<Date>;
}

Project.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    ownerId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    name: {
      type: new DataTypes.STRING(128),
      allowNull: false,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'projects',
  },
);

User.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: new DataTypes.STRING(128),
      allowNull: false,
    },
    preferredName: {
      type: new DataTypes.STRING(128),
      allowNull: true,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    tableName: 'users',
    sequelize, // passing the `sequelize` instance is required
  },
);

Address.init(
  {
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
    },
    address: {
      type: new DataTypes.STRING(128),
      allowNull: false,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    tableName: 'address',
    sequelize, // passing the `sequelize` instance is required
  },
);

// You can also define modules in a functional way
interface NoteAttributes {
  id: CreationOptional<number>;
  title: CreationOptional<string>;
  content: string;
}

// And with a functional approach defining a module looks like this
const Note: ModelDefined<NoteAttributes> = sequelize.define(
  'Note',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: new DataTypes.STRING(64),
      defaultValue: 'Unnamed Note',
    },
    content: {
      type: new DataTypes.STRING(4096),
      allowNull: false,
    },
  },
  {
    tableName: 'notes',
  },
);

// Here we associate which actually populates out pre-declared `association` static and other methods.
User.hasMany(Project, {
  sourceKey: 'id',
  foreignKey: 'ownerId',
  as: 'projects', // this determines the name in `associations`!
});

Address.belongsTo(User, { targetKey: 'id' });
User.hasOne(Address, { sourceKey: 'id' });

async function doStuffWithUser() {
  const newUser = await User.create({
    name: 'Johnny',
    preferredName: 'John',
  });
  console.log(newUser.id, newUser.name, newUser.preferredName);

  const project = await newUser.createProject({
    name: 'first!',
  });

  const ourUser = await User.findByPk(1, {
    include: [User.associations.projects],
    rejectOnEmpty: true, // Specifying true here removes `null` from the return type!
  });

  // Note the `!` null assertion since TS can't know if we included
  // the model or not
  console.log(ourUser.projects![0].name);
}

(async () => {
  await sequelize.sync();
  await doStuffWithUser();
})();
```

## Usage of `sequelize.define`

In Sequelize versions before v5, the default way of defining a model involved using `sequelize.define`. It's still possible to define models with that, and you can also add typings to these models using interfaces.

[//]: # (NOTE for maintainers: Keep the following code in sync with `typescriptDocs/Define.ts` to ensure it typechecks correctly.)

```typescript
import { Sequelize, Model, DataTypes, CreationOptional } from 'sequelize';

const sequelize = new Sequelize('mysql://root:asd123@localhost:3306/mydb');

// We recommend you declare an interface for the attributes, for stricter typechecking
// We need to declare an interface for our model that is basically what our class would be
interface IUserModel extends Model<IUserModel> {
  // Some fields are optional when calling UserModel.create() or UserModel.build()
  id: CreationOptional<number>;
  name: string;
}

const UserModel = sequelize.define<IUserModel>('User', {
  id: {
    primaryKey: true,
    type: DataTypes.INTEGER.UNSIGNED,
  },
  name: {
    type: DataTypes.STRING,
  },
});

async function doStuff() {
  const instance = await UserModel.findByPk(1, {
    rejectOnEmpty: true,
  });
  console.log(instance.id);
}
```

## Type inference for Attributes

Sequelize needs to be aware of the proper typing of your attributes, to ensure methods
like `Model.create`, `Model.findAll`, etc… are typed correctly.

In Sequelize 6, you had to write those typings by hand and pass them as generic to `Model`

Starting with Sequelize 7, Sequelize will infer your Model's attribute typings for
you using your class's public class fields!
It will consider any declared public class field to be an attribute except:

- Static fields and methods.
- Methods (anything whose type is a function).
- Fields whose type uses the branded type `NonAttribute`.

  ```typescript
  import { NonAttribute, Model } from 'sequelize';

  class User extends Model<User> {
    // 'id' is considered to be an attribute
    declare id: number;

    // 'projects' is not considered to be an attribute,
    // because its type uses 'NonAttribute'.
    declare projects?: NonAttribute<Project[]>;
  }
  ```

- Those excluded by the 'omit' generic option.

  ```typescript
  import { Model } from 'sequelize';

  class User extends Model<User, { omit: 'projects' | 'address' }> {
    // 'id' is considered to be an attribute
    declare id: number;

    // 'projects' is not considered to be an attribute,
    // because it has been added to the 'omit' option
    declare projects?: Project[];
    // 'address' is not considered to be an attribute
    // because it has been added to the 'omit' option
    declare address?: Address;
  }
  ```

- Those inherited from Sequelize's `Model` class (but not intermediary classes!).
  If one of your attributes shares the same name as one of the properties of `Model`, change its name.
  Doing this is likely to cause issues anyway.

**Note**: Getter & setters are not automatically excluded. This is because it's not possible to know whether a property is a getter or not through typings.

Set their return / parameter type to `NonAttribute`, or add them to `omit` to exclude them:

```typescript
import { Model, NonAttribute } from 'sequelize';

class User extends Model<User> {
  // 'firstName' is considered to be an attribute
  declare firstName: string;

  // you need to set its return value to NonAttribute<>
  //  or sequelize will consider this to be an attribute.
  get name(): NonAttribute<string> {
    return this.firstName;
  }
}

// or

// you can exclude the getter using 'omit':
class User extends Model<User, { omit: 'name' }> {
  declare firstName: string;

  get name(): string {
    return this.firstName;
  }
}
```

### Attributes optional during creation

Some attributes have default values, and are therefore optional when creating a new instance of your model.

The attribute typing inference will need a bit of help to properly mark these attributes as optional.

Here is a scenario where TypeScript will complain even though it is valid code:

```typescript
class User extends Model<User> {
  declare id: number;
}

// Typing Error! 'id' is missing, because TypeScript doesn't know that 'id' is optional.
await User.create({});
```

You fix that using the `CreationOptional` type. This type tells Sequelize
that the attribute is optional during model creation:

```typescript
class User extends Model<User> {
  declare id: CreationOptional<number>;
}

// No error! Since `id` has been marked as optional when creating an instance with `CreationOptional`.
await User.create({});
```

## Utility Types

### Requesting a Model Class

`ModelStatic` is designed to be used to type a Model *class*.

Here is an example of a utility method that requests a Model Class, and returns the list of primary keys defined in that class:

```typescript
import { ModelStatic, ModelAttributeColumnOptions, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';

/**
 * Returns the list of attributes that are part of the model's primary key.
 */
export function getPrimaryKeyAttributes(model: ModelStatic<any>): ModelAttributeColumnOptions[] {
  const attributes: ModelAttributeColumnOptions[] = [];

  for (const attribute of Object.values(model.rawAttributes)) {
    if (attribute.primaryKey) {
      attributes.push(attribute);
    }
  }

  return attributes;
}

class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  id: CreationOptional<number>;
}

User.init({
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
}, { sequelize });

const primaryAttributes = getPrimaryKeyAttributes(User);
```

### Getting a Model's attributes

If you need to access the list of attributes of a given model, `Attributes<Model>` and `CreationAttributes<Model>`
are what you need to use.

They will return the Attributes (and Creation Attributes) of the Model passed as a parameter.

Don't confuse them with `InferAttributes` and `InferCreationAttributes`. These two utility types should only every be used
in the definition of a Model to automatically create the list of attributes from the model's public class fields. They only work
with class-based model definitions (When using `Model.init`).

`Attributes<Model>` and `CreationAttributes<Model>` will return the list of attributes of any model, no matter how they were created (be it `Model.init` or `Sequelize#define`).

Here is an example of a utility function that requests a Model Class, and the name of an attribute ; and returns the corresponding attribute metadata.

```typescript
import {
  ModelStatic,
  ModelAttributeColumnOptions,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  Attributes
} from 'sequelize';

export function getAttributeMetadata<M extends Model>(model: ModelStatic<M>, attributeName: keyof Attributes<M>): ModelAttributeColumnOptions {
  const attribute = model.rawAttributes[attributeName];
  if (attribute == null) {
    throw new Error(`Attribute ${attributeName} does not exist on model ${model.name}`);
  }

  return attribute;
}

class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  id: CreationOptional<number>;
}

User.init({
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
}, { sequelize });

const idAttributeMeta = getAttributeMetadata(User, 'id'); // works!

// @ts-expect-error
const nameAttributeMeta = getAttributeMetadata(User, 'name'); // fails because 'name' is not an attribute of User
```
