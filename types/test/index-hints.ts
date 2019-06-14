import { User } from 'models/User';
import { IndexHints } from '..';

User.findAll({
  indexHints: [{
    type: IndexHints.FORCE,
    value: ['some_index'],
  }],
})
