import {User} from './models/User';

// $ExpectType User
new User({firstName: 'marty', group: {id: 1}});

// $ExpectError
new User({name: 'Marty', group: {id: 1}});
