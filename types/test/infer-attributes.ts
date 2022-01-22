import { expectTypeOf } from 'expect-type';
import { InferAttributes, InferCreationAttributes, CreationOptional, Model, NonAttribute, Attributes, CreationAttributes } from 'sequelize';

class User extends Model<
  InferAttributes<User, { omit: 'omittedAttribute' | 'omittedAttributeArray' }>,
  InferCreationAttributes<User, { omit: 'omittedAttribute' | 'omittedAttributeArray' }>
> {
  declare optionalAttribute: CreationOptional<number>;
  declare mandatoryAttribute: string;

  declare optionalArrayAttribute: CreationOptional<string[]>;
  declare mandatoryArrayAttribute: string[];

  declare nonAttribute: NonAttribute<boolean>;
  declare nonAttributeArray: NonAttribute<boolean[]>;

  declare omittedAttribute: number;
  declare omittedAttributeArray: number[];

  instanceMethod() {}
  static staticMethod() {}
}

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

expectTypeOf<UserAttributes['mandatoryArrayAttribute']>().not.toBeNullable();
expectTypeOf<UserCreationAttributes['mandatoryArrayAttribute']>().not.toBeNullable();

expectTypeOf<UserAttributes>().not.toHaveProperty('nonAttribute');
expectTypeOf<UserCreationAttributes>().not.toHaveProperty('nonAttribute');

expectTypeOf<UserAttributes>().not.toHaveProperty('nonAttributeArray');
expectTypeOf<UserCreationAttributes>().not.toHaveProperty('nonAttributeArray');

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
  // ensure branding does not break arrays.
  const brandedArray: NonAttribute<string[]> = [''];
  const anArray: string[] = brandedArray;
  const item: string = brandedArray[0];
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
  // ensure branding does not break instances
  const brandedUser: NonAttribute<User> = new User();
  const aUser: User = brandedUser;
}
