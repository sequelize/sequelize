import {User} from './models/User';

(async () => {
  // $ExpectType User[]
  await User.bulkCreate([
    {firstName: 'Marty', group: {id: 1}},
    {firstName: 'Emmett', group: {id: 1}},
  ])

  await User.bulkCreate([
    // $ExpectError
    {name: 'Marty', group: {id: 1}},
  ])

})();
