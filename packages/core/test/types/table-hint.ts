import { TableHints } from '@sequelize/core';
import { User } from './models/user';

User.findAll({
  tableHint: TableHints.NOLOCK,
});
