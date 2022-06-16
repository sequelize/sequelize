import { IndexHints } from '@sequelize/core';
import { User } from './models/User';

User.findAll({
  indexHints: [{
    type: IndexHints.FORCE,
    values: ['some_index'],
  }],
});
