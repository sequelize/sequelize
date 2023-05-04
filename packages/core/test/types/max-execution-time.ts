import { IndexHints } from '@sequelize/core';
import { User } from './models/user';

User.findAll({
  maxExecutionTimeHintMs: 1000,
});
