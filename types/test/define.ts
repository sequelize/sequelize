import { BuildOptions, DataTypes, Model } from 'sequelize';
import { sequelize } from './connection';

// I really wouldn't recommend this, but if you want you can still use define() and interfaces

interface UserAttributes {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
}

interface UserCreationAttributes extends Partial<UserAttributes> {}

interface UserModel extends Model<UserAttributes, UserCreationAttributes>, UserAttributes {}

const User = sequelize.define<UserModel>(
  'User', { firstName: DataTypes.STRING }, { tableName: 'users' });

async function test() {
    const user: UserModel = new User() as UserModel;

    const user2: UserModel | null = await User.findOne();
    if (!user2) return;

    user2.firstName = 'John';

    await user2.save();
}

// The below doesn't define Attribute types, but should still work
interface UntypedUserModel extends Model, UserAttributes {}

type UntypedUserModelStatic = typeof Model & {
  new (values?: keyof any, options?: BuildOptions): UntypedUserModel;
  customStaticMethod(): unknown;
}
const UntypedUser = sequelize.define<UntypedUserModel>(
  'User', { firstName: DataTypes.STRING }, { tableName: 'users' }) as UntypedUserModelStatic;

UntypedUser.customStaticMethod = () => {};

async function testUntyped() {
  UntypedUser.customStaticMethod();

  const user: UntypedUserModel = new UntypedUser() as UntypedUserModel;

  const user2: UntypedUserModel | null = await UntypedUser.findOne();
  if (!user2) return;

  user2.firstName = 'John';

  await user2.save();
}
