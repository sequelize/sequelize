import { expectTypeOf } from 'expect-type';
import { BuildOptions, DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from './connection';

// I really wouldn't recommend this, but if you want you can still use define() and interfaces

interface UserAttributes {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id'> {}

interface UserModel extends Model<UserAttributes, UserCreationAttributes>, UserAttributes {}

const User = sequelize.define<UserModel>(
  'User',
  {
    id: { type: DataTypes.NUMBER, primaryKey: true },
    username: DataTypes.STRING,
    firstName: DataTypes.STRING,
    lastName: DataTypes.STRING,
  },
  { tableName: 'users' },
);

async function test() {
  expectTypeOf<UserModel>().toMatchTypeOf(User.build());

  const user = await User.findOne();
  expectTypeOf(user).toEqualTypeOf<UserModel | null>();

  if (!user) return;
  user.firstName = 'John';
  await user.save();
}

// The below doesn't define Attribute types, but should still work
interface UntypedUserModel extends Model, UserAttributes {}

type UntypedUserModelStatic = typeof Model & {
  new (values?: keyof any, options?: BuildOptions): UntypedUserModel;
  customStaticMethod(): unknown;
};
const UntypedUser = sequelize.define<UntypedUserModel>(
  'User',
  {
    id: { type: DataTypes.NUMBER, primaryKey: true },
    username: DataTypes.STRING,
    firstName: DataTypes.STRING,
    lastName: DataTypes.STRING,
  },
  { tableName: 'users' },
) as UntypedUserModelStatic;

UntypedUser.customStaticMethod = () => {};

async function testUntyped() {
  UntypedUser.customStaticMethod();

  expectTypeOf<UntypedUserModel>().toMatchTypeOf(UntypedUser.build());

  const user = await UntypedUser.findOne();
  expectTypeOf(user).toEqualTypeOf<UntypedUserModel | null>();

  if (!user) return;
  user.firstName = 'John';
  await user.save();
}
