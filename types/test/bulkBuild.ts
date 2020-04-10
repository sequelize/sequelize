import {User} from './models/User';

// $ExpectType User[]
User.bulkBuild([
  {firstName: 'Marty', group: {id: 1}},
  {firstName: 'Emmett', group: {id: 1}},
])

User.bulkBuild([
  // $ExpectError
  {name: 'Marty', group: {id: 1}},
])

User.bulkBuild([
  // $ExpectError
  {firstName: 'Marty', group: {identifier: 1}},
])
