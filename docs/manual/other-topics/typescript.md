# TypeScript

Sequelize provides its own TypeScript definitions.

Please note that only **TypeScript >= 4.1** is supported.
Our TypeScript support does not follow SemVer. We will support TypeScript releases for at least one year, after which they may be dropped in a SemVer MINOR release.

As Sequelize heavily relies on runtime property assignments, TypeScript won't be very useful out of the box. A decent amount of manual type declarations are needed to make models workable.

## Installation

In order to avoid installation bloat for non TS users, you must install the following typing packages manually:

- `@types/node` (this is universally required in node projects)
- `@types/validator`

## Usage

Example of a minimal TypeScript project with strict type-checking for attributes.

**Important**: You must use `declare` on your class properties typings to ensure TypeScript does not emit those class properties.
See [Caveat with Public Class Fields](./model-basics.html#caveat-with-public-class-fields)

**NOTE:** Keep the following code in sync with `/types/test/typescriptDocs/ModelInit.ts` to ensure it typechecks correctly.

```typescript
/**
 * Keep this file in sync with the code in the "Usage" section in typescript.md
 */
import {
  Association, DataTypes, HasManyAddAssociationMixin, HasManyCountAssociationsMixin,
  HasManyCreateAssociationMixin, HasManyGetAssociationsMixin, HasManyHasAssociationMixin, Model,
  ModelDefined, Optional, Sequelize
} from "sequelize";

const sequelize = new Sequelize("mysql://root:asd123@localhost:3306/mydb");

// These are all the attributes in the User model
interface UserAttributes {
  id: number;
  name: string;
  preferredName: string | null;
}

// Some attributes are optional in `User.build` and `User.create` calls
interface UserCreationAttributes extends Optional<UserAttributes, "id"> {}

class User extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes {
  declare id: number; // Note that the `null assertion` `!` is required in strict mode.
  declare name: string;
  declare preferredName: string | null; // for nullable fields

  // timestamps!
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  // Since TS cannot determine model association at compile time
  // we have to declare them here purely virtually
  // these will not exist until `Model.init` was called.
  declare getProjects: HasManyGetAssociationsMixin<Project>; // Note the null assertions!
  declare addProject: HasManyAddAssociationMixin<Project, number>;
  declare hasProject: HasManyHasAssociationMixin<Project, number>;
  declare countProjects: HasManyCountAssociationsMixin;
  declare createProject: HasManyCreateAssociationMixin<Project>;

  // You can also pre-declare possible inclusions, these will only be populated if you
  // actively include a relation.
  declare readonly projects?: Project[]; // Note this is optional since it's only populated when explicitly requested in code

  declare static associations: {
    projects: Association<User, Project>;
  };
}

interface ProjectAttributes {
  id: number;
  ownerId: number;
  name: string;
  description?: string;
}

interface ProjectCreationAttributes extends Optional<ProjectAttributes, "id"> {}

class Project extends Model<ProjectAttributes, ProjectCreationAttributes>
  implements ProjectAttributes {
  declare id: number;
  declare ownerId: number;
  declare name: string;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

interface AddressAttributes {
  userId: number;
  address: string;
}

// You can write `extends Model<AddressAttributes, AddressAttributes>` instead,
// but that will do the exact same thing as below
class Address extends Model<AddressAttributes> implements AddressAttributes {
  declare userId: number;
  declare address: string;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

// You can also define modules in a functional way
interface NoteAttributes {
  id: number;
  title: string;
  content: string;
}

// You can also set multiple attributes optional at once
interface NoteCreationAttributes
  extends Optional<NoteAttributes, "id" | "title"> {}

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
    description: {
      type: new DataTypes.STRING(128),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "projects",
  }
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
  },
  {
    tableName: "users",
    sequelize, // passing the `sequelize` instance is required
  }
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
  },
  {
    tableName: "address",
    sequelize, // passing the `sequelize` instance is required
  }
);

// And with a functional approach defining a module looks like this
const Note: ModelDefined<
  NoteAttributes,
  NoteCreationAttributes
> = sequelize.define(
  "Note",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: new DataTypes.STRING(64),
      defaultValue: "Unnamed Note",
    },
    content: {
      type: new DataTypes.STRING(4096),
      allowNull: false,
    },
  },
  {
    tableName: "notes",
  }
);

// Here we associate which actually populates out pre-declared `association` static and other methods.
User.hasMany(Project, {
  sourceKey: "id",
  foreignKey: "ownerId",
  as: "projects", // this determines the name in `associations`!
});

Address.belongsTo(User, { targetKey: "id" });
User.hasOne(Address, { sourceKey: "id" });

async function doStuffWithUser() {
  const newUser = await User.create({
    name: "Johnny",
    preferredName: "John",
  });
  console.log(newUser.id, newUser.name, newUser.preferredName);

  const project = await newUser.createProject({
    name: "first!",
    ownerId: 123,
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

### Usage without strict types for attributes

The typings for Sequelize v5 allowed you to define models without specifying types for the attributes. This is still possible for backwards compatibility and for cases where you feel strict typing for attributes isn't worth it.

**NOTE:** Keep the following code in sync with `typescriptDocs/ModelInitNoAttributes.ts` to ensure
it typechecks correctly.

```ts
import { Sequelize, Model, DataTypes } from "sequelize";

const sequelize = new Sequelize("mysql://root:asd123@localhost:3306/mydb");

class User extends Model {
  public id!: number; // Note that the `null assertion` `!` is required in strict mode.
  public name!: string;
  public preferredName!: string | null; // for nullable fields
}

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
  },
  {
    tableName: "users",
    sequelize, // passing the `sequelize` instance is required
  }
);

async function doStuffWithUserModel() {
  const newUser = await User.create({
    name: "Johnny",
    preferredName: "John",
  });
  console.log(newUser.id, newUser.name, newUser.preferredName);

  const foundUser = await User.findOne({ where: { name: "Johnny" } });
  if (foundUser === null) return;
  console.log(foundUser.name);
}
```

## Usage of `sequelize.define`

In Sequelize versions before v5, the default way of defining a model involved using `sequelize.define`. It's still possible to define models with that, and you can also add typings to these models using interfaces.

**NOTE:** Keep the following code in sync with `typescriptDocs/Define.ts` to ensure
it typechecks correctly.

```ts
import { Sequelize, Model, DataTypes, Optional } from "sequelize";

const sequelize = new Sequelize("mysql://root:asd123@localhost:3306/mydb");

// We recommend you declare an interface for the attributes, for stricter typechecking
interface UserAttributes {
  id: number;
  name: string;
}

// Some fields are optional when calling UserModel.create() or UserModel.build()
interface UserCreationAttributes extends Optional<UserAttributes, "id"> {}

// We need to declare an interface for our model that is basically what our class would be
interface UserInstance
  extends Model<UserAttributes, UserCreationAttributes>,
    UserAttributes {}

const UserModel = sequelize.define<UserInstance>("User", {
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

If you're comfortable with somewhat less strict typing for the attributes on a model, you can save some code by defining the Instance to just extend `Model` without any attributes in the generic types.

**NOTE:** Keep the following code in sync with `typescriptDocs/DefineNoAttributes.ts` to ensure
it typechecks correctly.

```ts
import { Sequelize, Model, DataTypes } from "sequelize";

const sequelize = new Sequelize("mysql://root:asd123@localhost:3306/mydb");

// We need to declare an interface for our model that is basically what our class would be
interface UserInstance extends Model {
  id: number;
  name: string;
}

const UserModel = sequelize.define<UserInstance>("User", {
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
