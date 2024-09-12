import { User } from './models/User';

(async () => {
  const user = await User.create();

  await user.destroy({
    hooks: true
  });

  await User.destroy({
    hooks: false,
    where: { firstName: 'John' }
  });
})();
