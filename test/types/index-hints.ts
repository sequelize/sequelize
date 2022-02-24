import { User } from './models/User';
import { IndexHints } from '@sequelize/core';

User.findAll({
  indexHints: [{
    type: IndexHints.FORCE,
    values: ['some_index'],
  }],
});
