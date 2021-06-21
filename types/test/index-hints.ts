import { User } from 'models/User';
import { IndexHints } from '..';

User.findAll({
  indexHints: [{
    type: IndexHints.FORCE,
    values: ['some_index'],
  }],
});
