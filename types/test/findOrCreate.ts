import { User } from './models/User';

User.findOrCreate({ where: { firstName: 'Biff' }, defaults: { firstName: 'Biff', group: {} } });
