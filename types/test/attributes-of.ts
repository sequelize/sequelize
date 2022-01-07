import { expectTypeOf } from 'expect-type';
import { AttributesOf, CreationAttributesOf, CreationOptional, Model, NonAttribute } from 'sequelize';

type UserAttributes = AttributesOf<User, { omit: 'groups' }>;
type UserCreationAttributes = CreationAttributesOf<User, { omit: 'groups' }>;

class User extends Model<UserAttributes, UserCreationAttributes> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare anArray: CreationOptional<string[]>;

  // omitted using `omit` option
  declare groups: Group[];
  // omitted using `NonAttribute`
  declare projects: NonAttribute<Project>;

  instanceMethod() {}
  static staticMethod() {}
}

expectTypeOf<UserAttributes>().not.toBeAny();

{
  class Test extends Model<AttributesOf<Test>> {
    declare id: NonAttribute<string>;
  }

  const win: Test['_attributes'] = {};
}

{
  const win: UserAttributes = {
    id: 1,
    name: '',
    anArray: [''],
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
    anArray: undefined,
  };

  const fail1: UserCreationAttributes = {
    id: 1,
    name: '',
    // @ts-expect-error 'extra' does not exist
    extra: ''
  };

  const fail2: UserCreationAttributes = {
    id: 1,
    // @ts-expect-error name cannot be undefined
    name: undefined,
    anArray: undefined,
  };
}

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

class Project extends Model<AttributesOf<Project>> {
  declare id: number;
}

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
