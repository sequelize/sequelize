import {User} from './models/User';

(async () => {
  // $ExpectType [User, boolean]
  await User.findOrBuild({
    where: {},
    defaults: {firstName: 'Marty', group: {id: 1}},
  })

  await User.findOrBuild({
    where: {},
    // $ExpectError
    defaults: {name: 'Marty', group: {id: 1}},
  })

})();
