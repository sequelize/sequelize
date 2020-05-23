import {User} from './models/User';
import {UserGroup} from './models/UserGroup';

(async () => {
  // $ExpectType User
  await User.create({firstName: 'Marty', group: {id: 1}});

  // $ExpectError
  await User.create({name: 'Marty', group: {id: 1}});

  // $ExpectError
  await User.create({firstName: 1, group: {id: 1}});

  // $ExpectError
  await User.create({firstName: 'Marty', group: {identifier: 1}});

  // $ExpectType UserGroup
  await UserGroup.create({name: 'BTTF', users: [{firstName: 'Doc'}]});

  // $ExpectError
  await UserGroup.create({name: 'BTTF', users: [{name: 'Doc'}]});
})();
