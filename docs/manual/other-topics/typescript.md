# TypeScript

Since v5, Sequelize provides its own TypeScript definitions. Please note that only TS >= 3.1 is supported.

As Sequelize heavily relies on runtime property assignments, TypeScript won't be very useful out of the box. A decent amount of manual type declarations are needed to make models workable.

## Installation

In order to avoid installation bloat for non TS users, you must install the following typing packages manually:

- `@types/node` (this is universally required in node projects)
- `@types/validator`

## Usage

Example of a minimal TypeScript project:

```ts
import { Sequelize, Model, DataTypes, BuildOptions } from 'sequelize';
import { HasManyGetAssociationsMixin, HasManyAddAssociationMixin, HasManyHasAssociationMixin, Association, HasManyCountAssociationsMixin, HasManyCreateAssociationMixin } from 'sequelize';

// These are the minimum attributes needed to create a User
interface UserCreationAttributes {
  name: string;
  preferredName: string | null;
}

// These are all the attributes in the User model
interface UserAttributes extends UserCreationAttributes {
  id: number;
}

// You can choose to omit the `UserAttributes` and `UserCreationAttributes`
// generic types to simplify your types. This will come at the cost of making
// typechecking slightly less strict.
class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number; // Note that the `null assertion` `!` is required in strict mode.
  public name!: string;
  public preferredName!: string | null; // for nullable fields

  // timestamps!
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Since TS cannot determine model association at compile time
  // we have to declare them here purely virtually
  // these will not exist until `Model.init` was called.

  public getProjects!: HasManyGetAssociationsMixin<Project>; // Note the null assertions!
  public addProject!: HasManyAddAssociationMixin<Project, number>;
  public hasProject!: HasManyHasAssociationMixin<Project, number>;
  public countProjects!: HasManyCountAssociationsMixin;
  public createProject!: HasManyCreateAssociationMixin<Project>;

  // You can also pre-declare possible inclusions, these will only be populated if you
  // actively include a relation.
  public readonly projects?: Project[]; // Note this is optional since it's only populated when explicitly requested in code

  public static associations: {
    projects: Association<User, Project>;
  };
}

const sequelize = new Sequelize('mysql://root:asd123@localhost:3306/mydb');

interface ProjectAttributes {
  ownerId: number;
  name: string;
}

interface ProjectAttributes extends ProjectCreationAttributes {
  id: number;
}

class Project extends Model<ProjectAttributes, ProjectCreationAttributes> implements ProjectAttributes {
  public id!: number;
  public ownerId!: number;
  public name!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

interface AddressAttributes {
  userId: number;
  address: string;
}

class Address extends Model<AddressAttributes> implements AddressAttributes {
  public userId!: number;
  public address!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Project.init({
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
  }
}, {
  sequelize,
  tableName: 'projects',
});

User.init({
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
    allowNull: true
  }
}, {
  tableName: 'users',
  sequelize: sequelize, // passing the `sequelize` instance is required
});

Address.init({
  userId: {
    type: DataTypes.INTEGER.UNSIGNED,
  },
  address: {
    type: new DataTypes.STRING(128),
    allowNull: false,
  }
}, {
  tableName: 'address',
  sequelize: sequelize, // passing the `sequelize` instance is required
});

// Here we associate which actually populates out pre-declared `association` static and other methods.
User.hasMany(Project, {
  sourceKey: 'id',
  foreignKey: 'ownerId',
  as: 'projects' // this determines the name in `associations`!
});

Address.belongsTo(User, {targetKey: 'id'});
User.hasOne(Address,{sourceKey: 'id'});

async function stuff() {
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
  console.log(ourUser.projects![0].name); // Note the `!` null assertion since TS can't know if we included
                                          // the model or not
}
```

## Usage of `sequelize.define`

In Sequelize versions before v5, the default way of defining a model involved using `sequelize.define`. It's still possible to define models with that, and you can also add typings to these models using interfaces.

```ts
// We recommend you declare an interface for the attributes, for stricter typechecking
interface MyModelAttributes {
  readonly id: number;
  name: string;
}

interface MyModelCreationAttributes extends Optional<MyModelAttributes, 'id'> {}

// We need to declare an interface for our model that is basically what our class would be
interface MyModel extends Model<MyModelAttributes, MyModelCreationAttributes>, MyModelAttributes {}

const MyDefineModel = sequelize.define<MyModel>('MyDefineModel', {
  id: {
    primaryKey: true,
    type: DataTypes.INTEGER.UNSIGNED,
  }
});

async function stuffTwo() {
  const myModel = await MyDefineModel.findByPk(1, {
    rejectOnEmpty: true,
  });
  console.log(myModel.id);
}
```

If you're comfortable with somewhat less strict typing for the attributes on a model, you can save some code by defining the Instance to just extend `Model` without any attributes in the generic types.

```ts
// We need to declare an interface for our model that is basically what our class would be
interface MyModel extends Model {
  readonly id: number;
  name: string;
}

const MyDefineModel = sequelize.define<MyModel>('MyDefineModel', {
  id: {
    primaryKey: true,
    type: DataTypes.INTEGER.UNSIGNED,
  }
});

async function stuffTwo() {
  const myModel = await MyDefineModel.findByPk(1, {
    rejectOnEmpty: true,
  });
  console.log(myModel.id);
}
```
