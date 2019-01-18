import { DataTypes, Model } from 'sequelize';
import { sequelize } from './connection';

// I really wouldn't recommend this, but if you want you can still use define() and interfaces

interface User extends Model {
    id: number;
    username: string;
    firstName: string;
    lastName: string;
    createdAt: Date;
    updatedAt: Date;
}

type UserModel = {
    new (): User
    customStaticMethod(): any
} & typeof Model;

const User = sequelize.define('User', { firstName: DataTypes.STRING }, { tableName: 'users' }) as UserModel;

async function test() {
    User.customStaticMethod();

    const user: User = new User();

    const user2: User = (await User.findOne()) as User;

    user2.firstName = 'John';

    await user2.save();
}
