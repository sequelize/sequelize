import { User } from './models/user';

User.findAll({
  maxExecutionTimeHintMs: 1000,
});
