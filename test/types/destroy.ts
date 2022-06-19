import { User } from './models/user';

(async () => {
  const user = await User.create();

  await user.destroy({
    hooks: true,
  });

  await User.destroy({
    hooks: false,
    where: { firstName: 'John' },
  });
})();
