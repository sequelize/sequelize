import { expectTypeOf } from 'expect-type';
import { AttributesOf, CreationAttributesOf, CreationOptional, Model } from 'sequelize';

type GroupAttributes = AttributesOf<Group>;

class Group extends Model<GroupAttributes> {
  declare id: number;
}

{
  // @ts-expect-error - id should not be missing
  const fail1: GroupAttributes = {};

  // @ts-expect-error - id should not be missing
  const fail2: AttributesOf<Group, {}> = {};

  // @ts-expect-error - id should not be missing
  const fail3: AttributesOf<Group, { omit: never }> = {};
}


declare const Brand: unique symbol;

type Branded<T> = T | { [Brand]: true };
type BrandedString = Branded<string>;
const works: { [Brand]: true } extends BrandedString ? 1 : 0 = 1;
const brandedString: Branded<string> = 'test';
const myString: string = brandedString;

type UserAttributes = AttributesOf<User, { omit: 'groups' }>;
type UserCreationAttributes = CreationAttributesOf<User, { omit: 'groups' }>;

class User extends Model<UserAttributes, UserCreationAttributes> {
  declare id: CreationOptional<number>;
  declare name: string | undefined;

  declare groups: Group[];

  instanceMethod() {}
  static staticMethod() {}
}

expectTypeOf<UserAttributes>().not.toBeAny();

{
  const win: UserAttributes = {
    id: 1,
    name: '',
  };

  const fail1: UserAttributes = {
    id: 1,
    name: '',
    // @ts-expect-error - 'extra' should not be present
    extra: ''
  };

// @ts-expect-error - 'name' should be present
  const fail2: UserAttributes = {
    id: 1,
  };
}

{
  const win: UserCreationAttributes = {
    id: undefined,
    name: '',
  };

  const fail1: UserCreationAttributes = {
    id: 1,
    name: '',
    // @ts-expect-error 'extra' does not exist
    extra: ''
  };

// @ts-expect-error missing 'name'
  const fail2: UserCreationAttributes = {
    id: 1,
  };
}
