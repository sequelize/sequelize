import { User } from './models/User';
import { UserGroup } from './models/UserGroup';

User.create({firstName: 'Marty', group: {id: 1}});
UserGroup.create({name: 'BTTF', users: [{firstName: 'Doc'}]});
