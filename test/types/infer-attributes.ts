import { expectTypeOf } from 'expect-type';
import {
  Attributes,
  CreationAttributes,
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
  Sequelize,
} from 'sequelize';

class Project extends Model<InferAttributes<Project>> {
  declare id: number;
}

class User extends Model<InferAttributes<User, { omit: 'omittedAttribute' | 'omittedAttributeArray' }>,
  InferCreationAttributes<User, { omit: 'omittedAttribute' | 'omittedAttributeArray' }>> {
  declare optionalAttribute: CreationOptional<number>;
  declare mandatoryAttribute: string;

  declare optionalArrayAttribute: CreationOptional<string[]>;
  declare mandatoryArrayAttribute: string[];

  // note: using CreationOptional here is unnecessary, but we still ensure that it works.
  declare nullableOptionalAttribute: CreationOptional<string | null>;

  declare nonAttribute: NonAttribute<string>;
  declare nonAttributeArray: NonAttribute<string[]>;
  declare nonAttributeNestedArray: NonAttribute<string[][]>;

  declare omittedAttribute: number;
  declare omittedAttributeArray: number[];

  declare joinedEntity?: NonAttribute<Project>;
  declare projectId: CreationOptional<ForeignKey<number>>;

  instanceMethod() {
  }

  static staticMethod() {
  }
}

User.init({
  mandatoryArrayAttribute: DataTypes.ARRAY(DataTypes.STRING),
  mandatoryAttribute: DataTypes.STRING,
  // projectId is omitted but still works, because it is branded with 'ForeignKey'
  nullableOptionalAttribute: DataTypes.STRING,
  optionalArrayAttribute: DataTypes.ARRAY(DataTypes.STRING),
  optionalAttribute: DataTypes.INTEGER,
}, { sequelize: new Sequelize() });

type UserAttributes = Attributes<User>;
type UserCreationAttributes = CreationAttributes<User>;

expectTypeOf<UserAttributes>().not.toBeAny();
expectTypeOf<UserCreationAttributes>().not.toBeAny();

expectTypeOf<UserAttributes['optionalAttribute']>().not.toBeNullable();
expectTypeOf<UserCreationAttributes['optionalAttribute']>().toBeNullable();

expectTypeOf<UserAttributes['mandatoryAttribute']>().not.toBeNullable();
expectTypeOf<UserCreationAttributes['mandatoryAttribute']>().not.toBeNullable();

expectTypeOf<UserAttributes['optionalArrayAttribute']>().not.toBeNullable();
expectTypeOf<UserCreationAttributes['optionalArrayAttribute']>().toBeNullable();

type NonUndefined<T> = T extends undefined ? never : T;

expectTypeOf<UserCreationAttributes['nullableOptionalAttribute']>().not.toEqualTypeOf<NonUndefined<UserCreationAttributes['nullableOptionalAttribute']>>();

expectTypeOf<UserAttributes['mandatoryArrayAttribute']>().not.toBeNullable();
expectTypeOf<UserCreationAttributes['mandatoryArrayAttribute']>().not.toBeNullable();

expectTypeOf<UserAttributes>().not.toHaveProperty('nonAttribute');
expectTypeOf<UserCreationAttributes>().not.toHaveProperty('nonAttribute');

expectTypeOf<UserAttributes>().not.toHaveProperty('nonAttributeArray');
expectTypeOf<UserCreationAttributes>().not.toHaveProperty('nonAttributeArray');

expectTypeOf<UserAttributes>().not.toHaveProperty('nonAttributeNestedArray');
expectTypeOf<UserCreationAttributes>().not.toHaveProperty('nonAttributeNestedArray');

expectTypeOf<UserAttributes>().not.toHaveProperty('omittedAttribute');
expectTypeOf<UserCreationAttributes>().not.toHaveProperty('omittedAttribute');

expectTypeOf<UserAttributes>().not.toHaveProperty('omittedAttributeArray');
expectTypeOf<UserCreationAttributes>().not.toHaveProperty('omittedAttributeArray');

expectTypeOf<UserAttributes>().not.toHaveProperty('instanceMethod');
expectTypeOf<UserCreationAttributes>().not.toHaveProperty('instanceMethod');

expectTypeOf<UserAttributes>().not.toHaveProperty('staticMethod');
expectTypeOf<UserCreationAttributes>().not.toHaveProperty('staticMethod');

// brands:

{
  const user = User.build({ mandatoryArrayAttribute: [], mandatoryAttribute: '' });

  // ensure branding does not break arrays.
  const brandedArray: NonAttribute<string[]> = user.nonAttributeArray;
  const anArray: string[] = user.nonAttributeArray;
  const item: boolean = user.nonAttributeArray[0].endsWith('');
}

{
  // ensure branding does not break objects
  const brandedObject: NonAttribute<Record<string, string>> = {};
  const anObject: Record<string, string> = brandedObject;
  const item: string = brandedObject.key;
}

{
  // ensure branding does not break primitives
  const brandedString: NonAttribute<string> = '';
  const aString: string = brandedString;
}

{
  const user = User.build({ mandatoryArrayAttribute: [], mandatoryAttribute: '' });
  const project: Project = user.joinedEntity!;

  // ensure branding does not break objects
  const id = project.id;
}

{
  // ensure branding does not break null
  const brandedString: NonAttribute<string | null> = null;
}

{
  class User2 extends Model<InferAttributes<User2>, InferCreationAttributes<User2>> {
    declare nullableAttribute: string | null;
  }

  // this should work, all null attributes are optional in Model.create
  User2.create({});
}
