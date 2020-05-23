import {User} from './models/User';

(async () => {
  // $ExpectType [User, boolean]
  await User.findOrCreate({where: {firstName: 'Biff'}, defaults: {firstName: 'Biff', group: {}}});

  // $ExpectError
  await User.findOrCreate({where: {firstName: 'Biff'}, defaults: {name: 'Biff', group: {}}});
})();
