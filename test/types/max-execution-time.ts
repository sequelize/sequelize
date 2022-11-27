import { IndexHints } from '@sequelize/core';
import { User } from './models/user';

User.findAll({
  maxExecutionTimeMs: 1000,
});
