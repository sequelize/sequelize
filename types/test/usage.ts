import { Group, User } from './models/User';
import 'sequelize/lib/model';

declare module 'sequelize/lib/model' {
  export interface InstanceUpdateOptions {
    stuff?: number;
  }
}

async function test(): Promise<void> {
    let user = await User.findOne({ include: [Group] });
    if (!user) {
        return;
    }
    User.update({}, { where: {}, });
    user.firstName = 'John';
    await user.save();
    await user.update({}, { stuff: 1 })
    await user.setGroup(2);

    user = new User();
    user = new User({ firstName: 'John' });

    user = await User.findOne();

    const user2 = await User.create({ firstName: 'John', groupId: 1 });
    await User.findAndCountAll({ distinct: true });
}
