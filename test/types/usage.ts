import { Group, User } from './models/User';

async function test(): Promise<void> {
    let user = await User.findOne({ include: [Group] });
    if (!user) {
        return;
    }
    User.update({}, { where: {} });
    user.firstName = 'John';
    await user.save();
    await user.setGroup(2);

    user = new User();
    user = new User({ firstName: 'John' });

    user = await User.findOne();

    if (!user) {
      return;
    }

    user.update({}, {});
    user.update({}, {
      silent: true
    });

    const user2 = await User.create({ firstName: 'John', groupId: 1 });
    await User.findAndCountAll({ distinct: true });

    const user3 = await User.create({ firstName: 'Jane', groupId: 1 }, { validate: false });
    await User.findAndCountAll({ distinct: true });
}
