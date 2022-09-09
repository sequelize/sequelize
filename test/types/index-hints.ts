import { IndexHints } from '@sequelize/core';
import { User } from './models/user';

User.findAll({
  indexHints: [{
    type: IndexHints.FORCE,
    values: ['some_index'],
  }],
});
