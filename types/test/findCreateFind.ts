import {User} from './models/User';

(async () => {
  // $ExpectType [User, boolean]
  await User.findCreateFind({
    where: {},
    defaults: {firstName: 'Marty', group: {id: 1}},
  })

  await User.findCreateFind({
    where: {},
    // $ExpectError
    defaults: {name: 'Marty', group: {id: 1}},
  })

})();
