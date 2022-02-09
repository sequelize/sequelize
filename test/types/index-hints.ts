import { User } from './models/User';
import { IndexHints } from 'sequelize';

User.findAll({
  indexHints: [{
    type: IndexHints.FORCE,
    values: ['some_index'],
  }],
});
